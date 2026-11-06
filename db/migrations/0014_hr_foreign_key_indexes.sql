-- 0014: support indexes for the employee-history and personnel-document foreign keys.
-- Additive migration. Apply on Neon Development before deploying this revision.

CREATE INDEX IF NOT EXISTS employee_history_changed_by_idx
  ON public.employee_history(changed_by)
  WHERE changed_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS employee_documents_uploaded_by_idx
  ON public.employee_documents(uploaded_by)
  WHERE uploaded_by IS NOT NULL;
