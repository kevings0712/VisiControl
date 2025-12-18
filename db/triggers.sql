                                                                      ?column?                                                                       
-----------------------------------------------------------------------------------------------------------------------------------------------------
 -- public.inmates -> trg_inmates_updated                                                                                                           +
 DROP TRIGGER IF EXISTS trg_inmates_updated ON public.inmates;                                                                                      +
 CREATE TRIGGER trg_inmates_updated BEFORE UPDATE ON inmates FOR EACH ROW EXECUTE FUNCTION set_updated_at_inmates();                                +
 
 -- public.users -> trg_users_updated_at                                                                                                            +
 DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;                                                                                       +
 CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();                                         +
 
 -- public.visits -> trg_visits_auth                                                                                                                +
 DROP TRIGGER IF EXISTS trg_visits_auth ON public.visits;                                                                                           +
 CREATE TRIGGER trg_visits_auth BEFORE INSERT OR UPDATE OF inmate_id, created_by ON visits FOR EACH ROW EXECUTE FUNCTION enforce_visit_assignment();+
 
 -- public.visits -> trg_visits_short                                                                                                               +
 DROP TRIGGER IF EXISTS trg_visits_short ON public.visits;                                                                                          +
 CREATE TRIGGER trg_visits_short BEFORE INSERT ON visits FOR EACH ROW EXECUTE FUNCTION set_visit_short_code();                                      +
 
(4 rows)

