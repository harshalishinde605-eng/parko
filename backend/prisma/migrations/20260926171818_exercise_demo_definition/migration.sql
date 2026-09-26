-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "body_side" TEXT,
ADD COLUMN     "demo_config" JSONB,
ADD COLUMN     "demo_status" TEXT NOT NULL DEFAULT 'UNSUPPORTED',
ADD COLUMN     "monitoring_key" TEXT,
ADD COLUMN     "starting_position" TEXT,
ADD COLUMN     "tempo" TEXT DEFAULT 'slow';
