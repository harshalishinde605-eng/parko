-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "resolved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "caregiver_observations" ADD COLUMN     "occurred_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "symptom_logs" ADD COLUMN     "occurred_at" TIMESTAMP(3);
