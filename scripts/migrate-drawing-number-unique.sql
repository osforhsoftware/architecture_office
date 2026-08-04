-- Unique office drawing register numbers (multiple NULLs allowed).
CREATE UNIQUE INDEX uq_projects_drawing_number ON projects (drawing_number);
