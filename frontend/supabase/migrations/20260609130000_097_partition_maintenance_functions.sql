-- Migration 097: Partition maintenance helper functions
-- These functions enable the maintain-partitions edge function to manage org_usage partitions

-- Function: List all org_usage partitions
CREATE OR REPLACE FUNCTION list_org_usage_partitions()
RETURNS TABLE (tablename text) AS $$
BEGIN
  RETURN QUERY
  SELECT t.tablename::text
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename LIKE 'org_usage_%'
    AND t.tablename ~ '^org_usage_[0-9]{4}_[0-9]{2}$'
  ORDER BY t.tablename DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Create a partition for org_usage
-- Parameters: table_name, start_date, end_date
CREATE OR REPLACE FUNCTION create_org_usage_partition(
  p_table_name text,
  p_start_date date,
  p_end_date date
)
RETURNS boolean AS $$
BEGIN
  -- Validate table name format (security)
  IF p_table_name !~ '^org_usage_[0-9]{4}_[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid partition table name format: %', p_table_name;
  END IF;

  -- Create the partition
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF org_usage FOR VALUES FROM (%L) TO (%L)',
    p_table_name,
    p_start_date,
    p_end_date
  );

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create partition %: %', p_table_name, SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Drop a partition for org_usage
-- Parameters: table_name
CREATE OR REPLACE FUNCTION drop_org_usage_partition(p_table_name text)
RETURNS boolean AS $$
BEGIN
  -- Validate table name format (security)
  IF p_table_name !~ '^org_usage_[0-9]{4}_[0-9]{2}$' THEN
    RAISE EXCEPTION 'Invalid partition table name format: %', p_table_name;
  END IF;

  -- Drop the partition
  EXECUTE format('DROP TABLE IF EXISTS %I', p_table_name);

  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to drop partition %: %', p_table_name, SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get partition date range
CREATE OR REPLACE FUNCTION get_org_usage_partition_range()
RETURNS TABLE (min_partition text, max_partition text) AS $$
BEGIN
  RETURN QUERY
  SELECT
    MIN(t.tablename)::text as min_partition,
    MAX(t.tablename)::text as max_partition
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename LIKE 'org_usage_%'
    AND t.tablename ~ '^org_usage_[0-9]{4}_[0-9]{2}$';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to service_role only
GRANT EXECUTE ON FUNCTION list_org_usage_partitions() TO service_role;
GRANT EXECUTE ON FUNCTION create_org_usage_partition(text, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION drop_org_usage_partition(text) TO service_role;
GRANT EXECUTE ON FUNCTION get_org_usage_partition_range() TO service_role;

-- Revoke from public for security
REVOKE ALL ON FUNCTION list_org_usage_partitions() FROM PUBLIC;
REVOKE ALL ON FUNCTION create_org_usage_partition(text, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION drop_org_usage_partition(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_org_usage_partition_range() FROM PUBLIC;
