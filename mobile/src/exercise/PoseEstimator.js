// MoveNet pose estimator (TensorFlow.js, on-device). Singleton.
// Model downloads on first init (internet required once); all inference
// stays on the phone — no images ever leave the device.
let tf = null;
let posedetection = null;
let decodeJpeg = null;
let detector = null;
let initPromise = null;
let loadError = null;

async function ensureTf() {
  if (!tf) {
    tf = require('@tensorflow/tfjs');
    const rn = require('@tensorflow/tfjs-react-native');
    decodeJpeg = rn.decodeJpeg;
    posedetection = require('@tensorflow-models/pose-detection');
  }
  await tf.ready();
  return tf;
}

// onProgress(message) callbacks for UI. Throws on failure with .code.
async function initEstimator(onProgress) {
  if (detector) return detector;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      onProgress && onProgress('Preparing on-device AI…');
      await ensureTf();
      onProgress && onProgress('Loading movement model (one-time download)…');
      detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, {
        modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
      });
      // Warm-up inference so first real frame is fast.
      const warm = tf.zeros([192, 192, 3], 'int32');
      try { await detector.estimatePoses(warm); } finally { warm.dispose(); }
      onProgress && onProgress('Ready');
      return detector;
    } catch (e) {
      loadError = e;
      detector = null;
      initPromise = null;
      const err = new Error('Movement model unavailable: ' + (e?.message || 'download failed'));
      err.code = 'MODEL_UNAVAILABLE';
      throw err;
    }
  })();
  return initPromise;
}

// tensor3d: int32 [h, w, 3]. Returns {keypoints, width, height} or null.
// keypoints: [{x, y, score, name}] in PIXELS of the input tensor.
async function estimatePose(tensor3d) {
  if (!detector) throw new Error('Estimator not initialized');
  const poses = await detector.estimatePoses(tensor3d);
  if (!poses || !poses.length) return null;
  const p = poses[0];
  return { keypoints: p.keypoints || [], width: tensor3d.shape[1], height: tensor3d.shape[0] };
}

function toNormalized(est) {
  if (!est) return null;
  return est.keypoints.map((k) => ({ x: k.x / est.width, y: k.y / est.height, score: k.score ?? 0, name: k.name }));
}

async function disposeEstimator() {
  try { detector && detector.dispose && detector.dispose(); } catch { /* ignore */ }
  detector = null;
  initPromise = null;
}

module.exports = { initEstimator, estimatePose, toNormalized, disposeEstimator, decodeJpegFn: () => decodeJpeg };
