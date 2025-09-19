-- Create a function to get capacity breakdown for all models
CREATE OR REPLACE FUNCTION get_all_capacity_breakdown()
RETURNS TABLE (
    brand TEXT,
    model TEXT,
    capacity TEXT,
    color TEXT,
    carrier TEXT,
    device_count BIGINT,
    defective_count BIGINT,
    defective_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.brand,
        i.model,
        COALESCE(i.capacity, 'Unknown') as capacity,
        COALESCE(i.color, 'Unknown') as color,
        COALESCE(i.carrier, 'UNLOCKED') as carrier,
        COUNT(*) as device_count,
        COUNT(CASE WHEN i.working = 'NO' OR i.working = 'FAILED' THEN 1 END) as defective_count,
        ROUND(
            (COUNT(CASE WHEN i.working = 'NO' OR i.working = 'FAILED' THEN 1 END)::float / COUNT(*)) * 100, 
            1
        ) as defective_rate
    FROM product p
    INNER JOIN item i ON p.imei = i.imei
    GROUP BY p.brand, i.model, i.capacity, i.color, i.carrier
    ORDER BY p.brand, i.model, i.capacity, i.color, i.carrier;
END;
$$ LANGUAGE plpgsql;


