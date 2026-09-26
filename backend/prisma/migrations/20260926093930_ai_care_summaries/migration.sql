-- CreateTable
CREATE TABLE "ai_care_summaries" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "source_hash" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "engine" TEXT NOT NULL DEFAULT 'template',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_care_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_care_summaries_patient_id_period_start_idx" ON "ai_care_summaries"("patient_id", "period_start");

-- AddForeignKey
ALTER TABLE "ai_care_summaries" ADD CONSTRAINT "ai_care_summaries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
