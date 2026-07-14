-- Remove site-visit assignee rows for projects no longer at the site-visit stage.
DELETE pa FROM project_assignees pa
JOIN projects p ON p.id = pa.project_id
WHERE pa.stage_key = 'site_visit'
  AND NOT (p.section = 'Planning & Design' AND p.current_stage = 0);
