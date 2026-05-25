import os, json, time, shutil
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify
from flask_cors import CORS
from utils import preprocess, quality_score, is_unknown, gradcam, segment_digits, solve_expression

app = Flask(__name__)
CORS(app)

BASE = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE, 'model', 'cnn_mnist.keras')
HISTORY_PATH = os.path.join(BASE, 'model', 'history.json')
CORRECTIONS_DIR = os.path.join(BASE, 'corrections')
os.makedirs(CORRECTIONS_DIR, exist_ok=True)

model = None

def get_model():
    global model
    if model is None:
        if not os.path.exists(MODEL_PATH):
            return None
        model = tf.keras.models.load_model(MODEL_PATH)
    return model


def update_prediction_count():
    if not os.path.exists(HISTORY_PATH):
        return
    with open(HISTORY_PATH) as f:
        data = json.load(f)
    data['total_predictions'] = data.get('total_predictions', 0) + 1
    with open(HISTORY_PATH, 'w') as f:
        json.dump(data, f)


@app.route('/api/predict', methods=['POST'])
def predict():
    m = get_model()
    if m is None:
        return jsonify({'error': 'Model not trained. Run: python model/train.py'}), 503
    img_bytes = request.files['image'].read()
    arr = preprocess(img_bytes)
    probs = m.predict(arr, verbose=0)[0]
    pred = int(np.argmax(probs))
    conf = float(probs[pred])
    unknown = is_unknown(probs)
    qs, ql = quality_score(img_bytes)
    heatmap = gradcam(m, arr, pred) if not unknown else None
    update_prediction_count()
    return jsonify({
        'prediction': pred,
        'confidence': round(conf, 4),
        'probabilities': [round(float(p), 4) for p in probs],
        'unknown': unknown,
        'quality_score': qs,
        'quality_label': ql,
        'heatmap': heatmap,
    })


@app.route('/api/predict_multi', methods=['POST'])
def predict_multi():
    m = get_model()
    if m is None:
        return jsonify({'error': 'Model not trained'}), 503
    img_bytes = request.files['image'].read()
    segments = segment_digits(img_bytes)
    if not segments:
        return jsonify({'number': '', 'digits': []})
    digits = []
    for seg in segments:
        probs = m.predict(seg, verbose=0)[0]
        pred = int(np.argmax(probs))
        digits.append({'digit': pred, 'confidence': round(float(probs[pred]), 4),
                       'probabilities': [round(float(p), 4) for p in probs]})
    number = ''.join(str(d['digit']) for d in digits)
    return jsonify({'number': number, 'digits': digits})


@app.route('/api/solve_equation', methods=['POST'])
def solve_equation():
    img_bytes = request.files['image'].read()
    m = get_model()
    if m is None:
        return jsonify({'error': 'Model not trained'}), 503
    segments = segment_digits(img_bytes)
    # simple: just extract digits and operators from image
    # For full equation from canvas, fall back to text solve with extracted digits
    digits_str = ''.join(str(int(np.argmax(m.predict(s, verbose=0)[0]))) for s in segments)
    try:
        result, steps = solve_expression(digits_str)
        return jsonify({'expression': digits_str, 'result': result, 'steps': steps})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/solve_text', methods=['POST'])
def solve_text():
    data = request.get_json()
    expr = data.get('expression', '')
    try:
        result, steps = solve_expression(expr)
        return jsonify({'expression': expr, 'result': result, 'steps': steps})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/correct', methods=['POST'])
def correct():
    img_bytes = request.files['image'].read()
    label = request.form.get('correct_label', '')
    if not label.isdigit():
        return jsonify({'error': 'Invalid label'}), 400
    fname = os.path.join(CORRECTIONS_DIR, f"{label}_{int(time.time())}.png")
    with open(fname, 'wb') as f:
        f.write(img_bytes)
    return jsonify({'status': 'saved'})


@app.route('/api/dashboard', methods=['GET'])
def dashboard():
    if not os.path.exists(HISTORY_PATH):
        return jsonify({'error': 'No training data. Run: python model/train.py'}), 404
    with open(HISTORY_PATH) as f:
        return jsonify(json.load(f))


@app.route('/api/compare_models', methods=['POST'])
def compare_models():
    selected = request.get_json().get('models', ['CNN'])
    (_, _), (x_test, y_test) = tf.keras.datasets.mnist.load_data()
    x_test_flat = x_test.reshape(-1, 784).astype('float32') / 255.0
    x_test_cnn = x_test.reshape(-1, 28, 28, 1).astype('float32') / 255.0
    # use subset for speed
    idx = np.random.choice(len(x_test), 2000, replace=False)
    results = []
    for name in selected:
        t0 = time.time()
        try:
            if name == 'CNN':
                m = get_model()
                if m is None: continue
                y_pred = np.argmax(m.predict(x_test_cnn[idx], verbose=0), axis=1)
            elif name == 'MLP':
                from sklearn.neural_network import MLPClassifier
                clf = MLPClassifier(hidden_layer_sizes=(128, 64), max_iter=5, warm_start=False)
                clf.fit(x_test_flat[:5000], y_test[:5000])
                y_pred = clf.predict(x_test_flat[idx])
            elif name == 'SVM':
                from sklearn.svm import LinearSVC
                clf = LinearSVC(max_iter=500)
                clf.fit(x_test_flat[:5000], y_test[:5000])
                y_pred = clf.predict(x_test_flat[idx])
            elif name == 'KNN':
                from sklearn.neighbors import KNeighborsClassifier
                clf = KNeighborsClassifier(n_neighbors=3)
                clf.fit(x_test_flat[:3000], y_test[:3000])
                y_pred = clf.predict(x_test_flat[idx])
            elif name == 'Random Forest':
                from sklearn.ensemble import RandomForestClassifier
                clf = RandomForestClassifier(n_estimators=50)
                clf.fit(x_test_flat[:5000], y_test[:5000])
                y_pred = clf.predict(x_test_flat[idx])
            else:
                continue
            elapsed = time.time() - t0
            from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
            results.append({
                'model': name,
                'accuracy': round(accuracy_score(y_test[idx], y_pred), 4),
                'precision': round(precision_score(y_test[idx], y_pred, average='weighted', zero_division=0), 4),
                'recall': round(recall_score(y_test[idx], y_pred, average='weighted', zero_division=0), 4),
                'f1': round(f1_score(y_test[idx], y_pred, average='weighted', zero_division=0), 4),
                'speed': 'Fast' if elapsed < 5 else 'Medium' if elapsed < 15 else 'Slow',
            })
        except Exception as e:
            results.append({'model': name, 'error': str(e)})
    return jsonify(results)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
