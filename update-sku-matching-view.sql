-- Update sku_matching_view to include all necessary columns
DROP VIEW IF EXISTS sku_matching_view;

CREATE VIEW sku_matching_view AS
SELECT 
    p.imei,
    p.sku AS original_sku,
    COALESCE(i.matched_sku, smr.matched_sku) AS matched_sku,
    COALESCE(i.sku_match_score, smr.match_score) AS sku_match_score,
    COALESCE(i.sku_match_method, smr.match_method) AS sku_match_method,
    COALESCE(i.sku_match_status, smr.match_status) AS sku_match_status,
    COALESCE(i.sku_match_notes, smr.match_notes) AS sku_match_notes,
    COALESCE(smr.requires_attention, ((i.sku_match_status)::text = 'no_match'::text)) AS requires_attention,
    COALESCE(i.sku_matched_at, (smr.processed_at)::timestamp with time zone) AS match_processed_at,
    p.brand,
    i.model,
    i.carrier,
    i.capacity,
    i.color,
    i.working,
    i.location,
    dt.notes AS device_notes,
    CASE
        WHEN ((i.model IS NOT NULL) AND (i.capacity IS NOT NULL) AND (i.color IS NOT NULL)) THEN 'complete'::text
        WHEN ((i.model IS NOT NULL) AND (i.capacity IS NOT NULL)) THEN 'partial'::text
        ELSE 'incomplete'::text
    END AS data_completeness,
    GREATEST(p.date_in, COALESCE(mh.movement_date, p.date_in)) AS last_activity
FROM ((((product p
    LEFT JOIN item i ON (((p.imei)::text = (i.imei)::text)))
    LEFT JOIN device_test dt ON (((p.imei)::text = (dt.imei)::text)))
    LEFT JOIN movement_history mh ON (((p.imei)::text = (mh.imei)::text)))
    LEFT JOIN sku_matching_results smr ON (((p.imei)::text = (smr.imei)::text)))
WHERE (((mh.movement_date = ( SELECT max(mh2.movement_date) AS max
        FROM movement_history mh2
        WHERE ((mh2.imei)::text = (p.imei)::text))) OR (mh.movement_date IS NULL)) 
    AND ((dt.notes IS NULL) OR ((dt.notes !~~* '%FAIL%'::text) AND (dt.notes !~~* '%FAILED%'::text))));
