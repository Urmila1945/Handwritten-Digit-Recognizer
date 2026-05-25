import os
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model', 'cnn_mnist.keras')
HISTORY_PATH = os.path.join(os.path.dirname(__file__), 'model', 'history.json')


def build_cnn():
    m = models.Sequential([
        layers.Input((28, 28, 1)),
        layers.Conv2D(32, 3, activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.Conv2D(32, 3, activation='relu', padding='same'),
        layers.MaxPooling2D(),
        layers.Dropout(0.25),
        layers.Conv2D(64, 3, activation='relu', padding='same'),
        layers.BatchNormalization(),
        layers.Conv2D(64, 3, activation='relu', padding='same'),
        layers.MaxPooling2D(),
        layers.Dropout(0.25),
        layers.Flatten(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(10, activation='softmax'),
    ])
    m.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    return m


def train():
    (x_train, y_train), (x_test, y_test) = tf.keras.datasets.mnist.load_data()
    x_train = x_train.reshape(-1, 28, 28, 1).astype('float32') / 255.0
    x_test = x_test.reshape(-1, 28, 28, 1).astype('float32') / 255.0

    datagen = tf.keras.preprocessing.image.ImageDataGenerator(
        rotation_range=10, zoom_range=0.1, width_shift_range=0.1, height_shift_range=0.1
    )

    model = build_cnn()
    cb = [
        tf.keras.callbacks.EarlyStopping(patience=3, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(patience=2, factor=0.5),
    ]
    hist = model.fit(datagen.flow(x_train, y_train, batch_size=128),
                     validation_data=(x_test, y_test), epochs=20, callbacks=cb, verbose=1)

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save(MODEL_PATH)

    # save history
    history_data = []
    for i, (a, va, l, vl) in enumerate(zip(
        hist.history['accuracy'], hist.history['val_accuracy'],
        hist.history['loss'], hist.history['val_loss']
    )):
        history_data.append({'epoch': i + 1, 'accuracy': round(a, 4), 'val_accuracy': round(va, 4),
                              'loss': round(l, 4), 'val_loss': round(vl, 4)})

    # compute metrics
    y_pred = np.argmax(model.predict(x_test, verbose=0), axis=1)
    cm = confusion_matrix(y_test, y_pred).tolist()
    per_digit = {i: round(accuracy_score(y_test[y_test == i], y_pred[y_test == i]), 4) for i in range(10)}

    stats = {
        'accuracy': round(accuracy_score(y_test, y_pred), 4),
        'precision': round(precision_score(y_test, y_pred, average='weighted'), 4),
        'recall': round(recall_score(y_test, y_pred, average='weighted'), 4),
        'f1': round(f1_score(y_test, y_pred, average='weighted'), 4),
        'confusion_matrix': cm,
        'per_digit_accuracy': per_digit,
        'training_history': history_data,
        'total_predictions': 0,
    }
    with open(HISTORY_PATH, 'w') as f:
        json.dump(stats, f)
    print(f"Saved model → {MODEL_PATH}")
    print(f"Accuracy: {stats['accuracy']}")


if __name__ == '__main__':
    train()
