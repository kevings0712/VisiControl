--
-- PostgreSQL database dump
--

\restrict CfPN3EFXqtLr9P1vL8202ylH1Auk8c3es62WGl8Kw2sp5j7QPg0dEAybdCqfQjJ

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
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: relation_t; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.relation_t AS ENUM (
    'AUTHORIZED',
    'FAMILY',
    'LAWYER',
    'OTHER'
);


--
-- Name: enforce_visit_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_visit_assignment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.inmate_id IS NOT NULL AND NEW.created_by IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM user_inmates ui
       WHERE ui.user_id = NEW.created_by
         AND ui.inmate_id = NEW.inmate_id
    ) THEN
      RAISE EXCEPTION 'El usuario % no está autorizado para el interno %',
        NEW.created_by, NEW.inmate_id
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;


--
-- Name: set_updated_at_inmates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at_inmates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;


--
-- Name: set_visit_short_code(); Type: FUNCTION; Schema: public; Owner: -
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: inmates; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: user_inmates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_inmates (
    user_id uuid NOT NULL,
    inmate_id uuid NOT NULL,
    rel text DEFAULT 'AUTHORIZED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    relation public.relation_t DEFAULT 'AUTHORIZED'::public.relation_t NOT NULL,
    CONSTRAINT user_inmates_rel_check CHECK ((rel = ANY (ARRAY['AUTHORIZED'::text, 'FAMILY'::text, 'LAWYER'::text, 'OTHER'::text])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: visits; Type: TABLE; Schema: public; Owner: -
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
    short_code text
);


--
-- Name: inmates inmates_national_id_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inmates
    ADD CONSTRAINT inmates_national_id_uk UNIQUE (national_id);


--
-- Name: inmates inmates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inmates
    ADD CONSTRAINT inmates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: inmates uq_inmates_doc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inmates
    ADD CONSTRAINT uq_inmates_doc UNIQUE (doc_type, national_id);


--
-- Name: user_inmates user_inmates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_pkey PRIMARY KEY (user_id, inmate_id);


--
-- Name: user_inmates user_inmates_uk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_uk UNIQUE (user_id, inmate_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_national_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_national_id_key UNIQUE (national_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: idx_inmates_name_btree; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inmates_name_btree ON public.inmates USING btree (lower(full_name));


--
-- Name: idx_inmates_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inmates_name_trgm ON public.inmates USING gin (full_name public.gin_trgm_ops);


--
-- Name: idx_notif_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_notif_user_isread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_user_isread ON public.notifications USING btree (user_id, is_read);


--
-- Name: idx_notifications_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_created ON public.notifications USING btree (user_id, created_at DESC);


--
-- Name: idx_user_inmates_inmate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_inmates_inmate ON public.user_inmates USING btree (inmate_id);


--
-- Name: idx_user_inmates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_inmates_user ON public.user_inmates USING btree (user_id);


--
-- Name: idx_visits_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visits_status ON public.visits USING btree (status);


--
-- Name: idx_visits_visit_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_visits_visit_date ON public.visits USING btree (visit_date);


--
-- Name: notifications_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_unique ON public.notifications USING btree (user_id, visit_id, kind) WHERE (visit_id IS NOT NULL);


--
-- Name: uniq_notif_user_visit_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_notif_user_visit_kind ON public.notifications USING btree (user_id, visit_id, kind);


--
-- Name: users_email_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_uidx ON public.users USING btree (email);


--
-- Name: ux_notifications_user_visit_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_notifications_user_visit_kind ON public.notifications USING btree (user_id, visit_id, kind);


--
-- Name: inmates trg_inmates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_inmates_updated BEFORE UPDATE ON public.inmates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_inmates();


--
-- Name: users trg_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: visits trg_visits_auth; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visits_auth BEFORE INSERT OR UPDATE OF inmate_id, created_by ON public.visits FOR EACH ROW EXECUTE FUNCTION public.enforce_visit_assignment();


--
-- Name: visits trg_visits_short; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_visits_short BEFORE INSERT ON public.visits FOR EACH ROW EXECUTE FUNCTION public.set_visit_short_code();


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id) ON DELETE SET NULL;


--
-- Name: user_inmates user_inmates_inmate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_inmate_id_fkey FOREIGN KEY (inmate_id) REFERENCES public.inmates(id) ON DELETE CASCADE;


--
-- Name: user_inmates user_inmates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_inmates
    ADD CONSTRAINT user_inmates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: visits visits_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: visits visits_inmate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_inmate_id_fkey FOREIGN KEY (inmate_id) REFERENCES public.inmates(id);


--
-- PostgreSQL database dump complete
--

\unrestrict CfPN3EFXqtLr9P1vL8202ylH1Auk8c3es62WGl8Kw2sp5j7QPg0dEAybdCqfQjJ

