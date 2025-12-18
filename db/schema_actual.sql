--
-- PostgreSQL database dump
--

\restrict Aoew69JJf0dIVnYO4BvWEHoOSOJ64EZ1NM3OeuVLPJHuNkoxxo5RFMtdgM6ZtJa

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: relation_t; Type: TYPE; Schema: public; Owner: visictrl_admin
--

CREATE TYPE public.relation_t AS ENUM (
    'AUTHORIZED',
    'FAMILY',
    'LAWYER',
    'OTHER'
);


ALTER TYPE public.relation_t OWNER TO visictrl_admin;

--
-- Name: enforce_visit_assignment(); Type: FUNCTION; Schema: public; Owner: visictrl_admin
--

CREATE FUNCTION public.enforce_visit_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cnt      int;
  is_admin boolean;
BEGIN
  -- Si no hay created_by, no validamos nada
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- Chequear si el usuario es ADMIN
  SELECT (u.role = 'ADMIN')
    INTO is_admin
  FROM users u
  WHERE u.id = NEW.created_by
  LIMIT 1;

  -- Si es ADMIN, se salta la validación
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Usuario normal: debe tener relación en user_inmates
  SELECT COUNT(*)
    INTO cnt
  FROM user_inmates ui
  WHERE ui.user_id  = NEW.created_by
    AND ui.inmate_id = NEW.inmate_id;

  IF cnt = 0 THEN
    RAISE EXCEPTION
      'El usuario % no está autorizado para el interno %',
      NEW.created_by, NEW.inmate_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enforce_visit_assignment() OWNER TO visictrl_admin;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: visictrl_admin
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;


ALTER FUNCTION public.set_updated_at() OWNER TO visictrl_admin;

--
-- Name: set_updated_at_inmates(); Type: FUNCTION; Schema: public; Owner: visictrl_admin
--

CREATE FUNCTION public.set_updated_at_inmates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;


ALTER FUNCTION public.set_updated_at_inmates() OWNER TO visictrl_admin;

--
-- Name: set_visit_short_code(); Type: FUNCTION; Schema: public; Owner: visictrl_admin
--

CREATE FUNCTION public.set_visit_short_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := substr(NEW.id::text, 1, 8);
  END IF;
  RETURN NEW;
END $$;


ALTER FUNCTION public.set_visit_short_code() OWNER TO visictrl_admin;

--
-- Name: sp_mark_notifications_read(uuid); Type: FUNCTION; Schema: public; Owner: visictrl_admin
--

CREATE FUNCTION public.sp_mark_notifications_read(p_user uuid) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_affected int;
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = p_user AND is_read = false;
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END$$;


ALTER FUNCTION public.sp_mark_notifications_read(p_user uuid) OWNER TO visictrl_admin;

--
-- Name: tg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: visictrl_admin
--

CREATE FUNCTION public.tg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END$$;


ALTER FUNCTION public.tg_set_updated_at() OWNER TO visictrl_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _mv_visit_stats_7d_guard; Type: TABLE; Schema: public; Owner: visictrl_admin
--

CREATE TABLE public._mv_visit_stats_7d_guard (
    only_one boolean DEFAULT true NOT NULL
);


ALTER TABLE public._mv_visit_stats_7d_guard OWNER TO visictrl_admin;

--
-- Name: inmates; Type: TABLE; Schema: public; Owner: visictrl_admin
--

CREATE TABLE public.inmates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    full_name text GENERATED ALWAYS AS (TRIM(BOTH FROM ((first_name || ' '::text) || last_name))) STORED,
    doc_type text DEFAULT 'CEDULA'::text NOT NULL,
    national_id text,
    birth_date date,
    pavilion text,
    cell text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_inmates_cedula_format CHECK (((doc_type <> 'CEDULA'::text) OR (national_id ~ '^[0-9]{10}$'::text))),
    CONSTRAINT inmates_doc_type_check CHECK ((doc_type = ANY (ARRAY['CEDULA'::text, 'PASAPORTE'::text, 'OTRO'::text]))),
    CONSTRAINT inmates_status_check CHECK ((status = ANY (ARRAY['ACTIVE'::text, 'BLOCKED'::text, 'TRANSFERRED'::text, 'RELEASED'::text])))
);


ALTER TABLE public.inmates OWNER TO visictrl_admin;

--
-- Name: visits; Type: TABLE; Schema: public; Owner: visictrl_admin
--

CREATE TABLE public.visits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    visitor_name text NOT NULL,
    inmate_name text NOT NULL,
    visit_date date NOT NULL,
    visit_hour time without time zone NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    inmate_id uuid,
    short_code text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    duration_minutes integer DEFAULT 60 NOT NULL
);


ALTER TABLE public.visits OWNER TO visictrl_admin;

--
-- Name: mv_visit_stats_7d; Type: MATERIALIZED VIEW; Schema: public; Owner: visictrl_admin
--

CREATE MATERIALIZED VIEW public.mv_visit_stats_7d AS
 SELECT CURRENT_DATE AS generated_on,
    count(*) FILTER (WHERE (status = 'PENDING'::text)) AS pending_total,
    count(*) FILTER (WHERE (status = 'APPROVED'::text)) AS approved_total,
    count(*) FILTER (WHERE (status = 'REJECTED'::text)) AS rejected_total,
    count(*) FILTER (WHERE ((visit_date >= CURRENT_DATE) AND (visit_date <= (CURRENT_DATE + 7)))) AS next7_total
   FROM public.visits
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.mv_visit_stats_7d OWNER TO visictrl_admin;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: visictrl_admin
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    visit_id uuid,
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone,
    meta jsonb,
    CONSTRAINT notifications_kind_check CHECK ((kind = ANY (ARRAY['VISIT_CREATED'::text, 'VISIT_APPROVED'::text, 'VISIT_CANCELED'::text, 'VISIT_REMINDER'::text, 'VISIT_UPDATED'::text, 'SYSTEM'::text])))
);


ALTER TABLE public.notifications OWNER TO visictrl_admin;

--
-- Name: user_inmates; Type: TABLE; Schema: public; Owner: visictrl_admin
--

CREATE TABLE public.user_inmates (
    user_id uuid NOT NULL,
    inmate_id uuid NOT NULL,
    rel text DEFAULT 'AUTHORIZED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    relation public.relation_t DEFAULT 'AUTHORIZED'::public.relation_t NOT NULL,
    CONSTRAINT user_inmates_rel_check CHECK ((rel = ANY (ARRAY['AUTHORIZED'::text, 'FAMILY'::text, 'LAWYER'::text, 'OTHER'::text])))
);


ALTER TABLE public.user_inmates OWNER TO visictrl_admin;

--
-- Name: users; Type: TABLE; Schema: public; Owner: visictrl_admin
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'ORGANIZER'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    last_name text NOT NULL,
    national_id text,
    birth_date date NOT NULL,
    reset_token_hash text,
    reset_expires timestamp without time zone,
    phone text,
    address text,
    notify_email boolean DEFAULT true,
    updated_at timestamp without time zone DEFAULT now(),
    avatar_url text,
    CONSTRAINT users_national_id_10digits CHECK ((national_id ~ '^[0-9]{10}$'::text)),
    CONSTRAINT users_phone_10digits CHECK (((phone IS NULL) OR (phone ~ '^[0-9]{10}$'::text)))
);


ALTER TABLE public.users OWNER TO visictrl_admin;

--
-- Name: v_notifications_unread; Type: VIEW; Schema: public; Owner: visictrl_admin
--

CREATE VIEW public.v_notifications_unread AS
 SELECT n.id,
    n.user_id,
    u.name AS user_name,
    n.visit_id,
    n.kind,
    n.title,
    n.body,
    n.created_at
   FROM (public.notifications n
     LEFT JOIN public.users u ON ((u.id = n.user_id)))
  WHERE (n.is_read IS NOT TRUE)
  ORDER BY n.created_at DESC;


ALTER VIEW public.v_notifications_unread OWNER TO visictrl_admin;

--
-- Name: _mv_visit_stats_7d_guard _mv_visit_stats_7d_guard_pkey; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public._mv_visit_stats_7d_guard
    ADD CONSTRAINT _mv_visit_stats_7d_guard_pkey PRIMARY KEY (only_one);


--
-- Name: inmates inmates_national_id_uk; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.inmates
    ADD CONSTRAINT inmates_national_id_uk UNIQUE (national_id);


--
-- Name: inmates inmates_pkey; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.inmates
    ADD CONSTRAINT inmates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: inmates uq_inmates_doc; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.inmates
    ADD CONSTRAINT uq_inmates_doc UNIQUE (doc_type, national_id);


--
-- Name: user_inmates user_inmates_pkey; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_pkey PRIMARY KEY (user_id, inmate_id);


--
-- Name: user_inmates user_inmates_uk; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_uk UNIQUE (user_id, inmate_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_national_id_key; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_national_id_key UNIQUE (national_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: idx_inmates_name_btree; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_inmates_name_btree ON public.inmates USING btree (lower(full_name));


--
-- Name: idx_inmates_name_trgm; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_inmates_name_trgm ON public.inmates USING gin (full_name public.gin_trgm_ops);


--
-- Name: idx_notif_user_created; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_notif_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notif_user_isread; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_notif_user_isread ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_user_inmates_inmate; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_user_inmates_inmate ON public.user_inmates USING btree (inmate_id);


--
-- Name: idx_user_inmates_user; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_user_inmates_user ON public.user_inmates USING btree (user_id);


--
-- Name: idx_visits_status; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_visits_status ON public.visits USING btree (status);


--
-- Name: idx_visits_visit_date; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE INDEX idx_visits_visit_date ON public.visits USING btree (visit_date);


--
-- Name: notifications_unique; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE UNIQUE INDEX notifications_unique ON public.notifications USING btree (user_id, visit_id, kind) WHERE (visit_id IS NOT NULL);


--
-- Name: uniq_notif_user_visit_kind; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE UNIQUE INDEX uniq_notif_user_visit_kind ON public.notifications USING btree (user_id, visit_id, kind);


--
-- Name: uq_mv_visit_stats_7d; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE UNIQUE INDEX uq_mv_visit_stats_7d ON public.mv_visit_stats_7d USING btree (generated_on);


--
-- Name: users_email_uidx; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE UNIQUE INDEX users_email_uidx ON public.users USING btree (email);


--
-- Name: ux_notifications_user_visit_kind; Type: INDEX; Schema: public; Owner: visictrl_admin
--

CREATE UNIQUE INDEX ux_notifications_user_visit_kind ON public.notifications USING btree (user_id, visit_id, kind);


--
-- Name: inmates trg_inmates_updated; Type: TRIGGER; Schema: public; Owner: visictrl_admin
--

CREATE TRIGGER trg_inmates_updated BEFORE UPDATE ON public.inmates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_inmates();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: visictrl_admin
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: visits trg_visits_auth; Type: TRIGGER; Schema: public; Owner: visictrl_admin
--

CREATE TRIGGER trg_visits_auth BEFORE INSERT OR UPDATE OF inmate_id, created_by ON public.visits FOR EACH ROW EXECUTE FUNCTION public.enforce_visit_assignment();


--
-- Name: visits trg_visits_short; Type: TRIGGER; Schema: public; Owner: visictrl_admin
--

CREATE TRIGGER trg_visits_short BEFORE INSERT ON public.visits FOR EACH ROW EXECUTE FUNCTION public.set_visit_short_code();


--
-- Name: visits trg_visits_updated_at; Type: TRIGGER; Schema: public; Owner: visictrl_admin
--

CREATE TRIGGER trg_visits_updated_at BEFORE UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL;


--
-- Name: user_inmates user_inmates_inmate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_inmate_id_fkey FOREIGN KEY (inmate_id) REFERENCES public.inmates(id) ON DELETE CASCADE;


--
-- Name: user_inmates user_inmates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: visits visits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: visits visits_inmate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: visictrl_admin
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_inmate_id_fkey FOREIGN KEY (inmate_id) REFERENCES public.inmates(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Aoew69JJf0dIVnYO4BvWEHoOSOJ64EZ1NM3OeuVLPJHuNkoxxo5RFMtdgM6ZtJa

