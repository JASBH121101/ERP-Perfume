-- Runtime permissions for the append-only vacation ledger.
-- The application may read and append entries; UPDATE and DELETE remain forbidden.
GRANT SELECT, INSERT
ON TABLE public.hr_vacation_ledger
TO jb_erp_runtime_sql;
