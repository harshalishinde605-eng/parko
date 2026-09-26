// SnapshotFrameProvider — feeds camera frames to the pose pipeline.
// Uses expo-camera still captures on a throttle loop (no native frame
// processors on this SDK path). Tuned for SLOW physiotherapy movement:
// ~3-5 fps is sufficient for multi-second sit-to-stand cycles.
// Swappable: a future TensorStreamProvider/MLKitProvider with the same
// interface (start/stop/stats) slots in without touching analyzer or UI.
class SnapshotFrameProvider {
  constructor({ intervalMs = 280, quality = 0.35 } = {}) {
    this.intervalMs = intervalMs;
    this.quality = quality;
    this.running = false;
    this.frames = 0;
    this.errors = 0;
    this.startedAt = null;
    this._timer = null;
    this._busy = false;
  }

  start(cameraRef, onTensor, onStats) {
    if (this.running) return;
    this.running = true;
    this.startedAt = Date.now();
    const loop = async () => {
      if (!this.running) return;
      if (!this._busy && cameraRef.current) {
        this._busy = true;
        try {
          const photo = await cameraRef.current.takePictureAsync({
            quality: this.quality,
            base64: true,
            skipProcessing: true,
            shutterSound: false,
            exif: false,
          });
          if (photo?.base64) {
            this.frames += 1;
            await onTensor(photo.base64, photo.width || 0, photo.height || 0);
          }
        } catch (e) {
          this.errors += 1;
          onStats && onStats(this.stats(), e);
        } finally {
          this._busy = false;
        }
      }
      if (this.running) {
        onStats && onStats(this.stats());
        this._timer = setTimeout(loop, this.intervalMs);
      }
    };
    loop();
  }

  stop() {
    this.running = false;
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
  }

  stats() {
    const secs = this.startedAt ? Math.max(1, (Date.now() - this.startedAt) / 1000) : 1;
    return { fps: Math.round((this.frames / secs) * 10) / 10, frames: this.frames, errors: this.errors };
  }
}

module.exports = { SnapshotFrameProvider };
