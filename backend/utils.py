import numpy as np
import cv2
import base64
import io
import tensorflow as tf
from PIL import Image
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.cm as cm


def preprocess(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('L').resize((28, 28))
    arr = np.array(img, dtype=np.float32)
    arr = arr / 255.0
    # invert if background is white
    if arr.mean() > 0.5:
        arr = 1.0 - arr
    return arr.reshape(1, 28, 28, 1)


def quality_score(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('L')
    arr = np.array(img)
    # measure stroke clarity: contrast + coverage
    coverage = np.sum(arr < 128) / arr.size
    contrast = arr.std()
    score = int(min(100, coverage * 300 + contrast * 0.5))
    if score > 70:
        label = 'Clean'
    elif score > 40:
        label = 'Average'
    else:
        label = 'Messy'
    return score, label


def is_unknown(probs, threshold=0.5):
    return float(np.max(probs)) < threshold


def gradcam(model, img_array, pred_class):
    try:
        last_conv = next(l for l in reversed(model.layers) if isinstance(l, tf.keras.layers.Conv2D))
        grad_model = tf.keras.Model(model.inputs, [last_conv.output, model.output])
        with tf.GradientTape() as tape:
            conv_out, preds = grad_model(img_array)
            loss = preds[:, pred_class]
        grads = tape.gradient(loss, conv_out)[0]
        weights = tf.reduce_mean(grads, axis=(0, 1))
        cam = tf.reduce_sum(conv_out[0] * weights, axis=-1).numpy()
        cam = np.maximum(cam, 0)
        if cam.max() > 0:
            cam = cam / cam.max()
        cam = cv2.resize(cam, (28, 28))
        heatmap = cm.jet(cam)[:, :, :3]
        orig = np.squeeze(img_array) 
        orig_rgb = np.stack([orig, orig, orig], axis=-1)
        overlay = (0.4 * orig_rgb + 0.6 * heatmap)
        overlay = np.clip(overlay * 255, 0, 255).astype(np.uint8)
        overlay_large = cv2.resize(overlay, (140, 140), interpolation=cv2.INTER_NEAREST)
        buf = io.BytesIO()
        Image.fromarray(overlay_large).save(buf, format='PNG')
        return base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None


def segment_digits(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('L')
    arr = np.array(img)
    if arr.mean() > 128:
        arr = 255 - arr
    _, binary = cv2.threshold(arr, 50, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = sorted([cv2.boundingRect(c) for c in contours if cv2.boundingRect(c)[2] > 5 and cv2.boundingRect(c)[3] > 5], key=lambda b: b[0])
    segments = []
    for (x, y, w, h) in boxes:
        pad = 4
        x1, y1 = max(0, x - pad), max(0, y - pad)
        x2, y2 = min(arr.shape[1], x + w + pad), min(arr.shape[0], y + h + pad)
        crop = arr[y1:y2, x1:x2]
        crop_img = Image.fromarray(crop).resize((28, 28))
        crop_arr = np.array(crop_img, dtype=np.float32) / 255.0
        if crop_arr.mean() < 0.5:
            crop_arr = 1.0 - crop_arr
        segments.append(crop_arr.reshape(1, 28, 28, 1))
    return segments


def solve_expression(expr):
    from sympy import sympify, simplify
    import re
    expr = expr.replace('×', '*').replace('÷', '/').replace('−', '-').replace('^', '**')
    expr = re.sub(r'[^0-9+\-*/().** ]', '', expr)
    parsed = sympify(expr)
    result = float(parsed.evalf())
    steps = []
    import re as re2
    # basic step breakdown
    inner = re2.findall(r'\([^()]+\)', expr)
    for part in inner:
        try:
            val = float(sympify(part[1:-1]).evalf())
            steps.append(f"{part} = {val}")
            expr = expr.replace(part, str(val), 1)
        except Exception:
            pass
    steps.append(f"{expr} = {result}")
    return str(int(result) if result == int(result) else round(result, 4)), steps
