-- AlterTable
ALTER TABLE "exercise_logs" ADD COLUMN     "ai_assisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "avg_confidence" DOUBLE PRECISION,
ADD COLUMN     "detected_reps" INTEGER,
ADD COLUMN     "duration_sec" INTEGER,
ADD COLUMN     "form_notes" TEXT,
ADD COLUMN     "rom_summary" TEXT;
