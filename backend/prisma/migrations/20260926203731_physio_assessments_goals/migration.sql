-- AlterTable
ALTER TABLE "exercise_logs" ADD COLUMN     "feedback_reason" TEXT;

-- CreateTable
CREATE TABLE "physio_assessments" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "therapist_id" TEXT NOT NULL,
    "assessment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessment_type" TEXT NOT NULL DEFAULT 'initial',
    "tug" DOUBLE PRECISION,
    "walk_speed" DOUBLE PRECISION,
    "sit_to_stand" INTEGER,
    "balance_score" INTEGER,
    "balance_max" INTEGER DEFAULT 28,
    "problems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observations" TEXT,
    "notes" TEXT,
    "review_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physio_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rehab_goals" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "therapist_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "target" TEXT,
    "review_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rehab_goals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "physio_assessments_patient_id_assessment_date_idx" ON "physio_assessments"("patient_id", "assessment_date");

-- CreateIndex
CREATE INDEX "rehab_goals_patient_id_status_idx" ON "rehab_goals"("patient_id", "status");

-- AddForeignKey
ALTER TABLE "physio_assessments" ADD CONSTRAINT "physio_assessments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physio_assessments" ADD CONSTRAINT "physio_assessments_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rehab_goals" ADD CONSTRAINT "rehab_goals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rehab_goals" ADD CONSTRAINT "rehab_goals_therapist_id_fkey" FOREIGN KEY ("therapist_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
