--
-- PostgreSQL database dump
--

\restrict 7ilq4Nr9BDppcPuTPHmRD9SZ2fSbzDCu23rBkg8TF5E19927covUruW9vvekU2b

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: cache_locks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration integer NOT NULL
);


--
-- Name: failed_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection text NOT NULL,
    queue text NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: failed_jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;


--
-- Name: job_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);


--
-- Name: jobs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: jobs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    workflow_version_id uuid NOT NULL,
    cron_expression character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    next_run_at timestamp(0) without time zone,
    last_run_at timestamp(0) without time zone,
    timezone character varying(255) DEFAULT 'UTC'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: step_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.step_runs (
    id uuid NOT NULL,
    workflow_run_id uuid NOT NULL,
    node_id character varying(255) NOT NULL,
    node_type character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    started_at timestamp(0) without time zone,
    finished_at timestamp(0) without time zone,
    duration bigint,
    input json,
    output json,
    error_message text,
    retry_config json,
    retry_count integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp(0) without time zone,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    CONSTRAINT step_runs_node_type_check CHECK (((node_type)::text = ANY ((ARRAY['http'::character varying, 'delay'::character varying, 'condition'::character varying])::text[]))),
    CONSTRAINT step_runs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'skipped'::character varying, 'timeout'::character varying])::text[])))
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    settings json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'viewer'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    email_verified_at timestamp(0) without time zone,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'editor'::character varying, 'viewer'::character varying])::text[])))
);


--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhooks (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_triggered_at timestamp(0) without time zone,
    trigger_count integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: workflow_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_runs (
    id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    workflow_version_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    triggered_by uuid,
    trigger_type character varying(255) DEFAULT 'manual'::character varying NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    queue character varying(255) DEFAULT 'default'::character varying NOT NULL,
    queue_job_id character varying(255),
    queued_at timestamp(0) without time zone,
    started_at timestamp(0) without time zone,
    finished_at timestamp(0) without time zone,
    duration bigint,
    timeout_seconds integer DEFAULT 1800 NOT NULL,
    timeout_at timestamp(0) without time zone,
    input json,
    output json,
    error_message text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    CONSTRAINT workflow_runs_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'queued'::character varying, 'running'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'timeout'::character varying])::text[]))),
    CONSTRAINT workflow_runs_trigger_type_check CHECK (((trigger_type)::text = ANY ((ARRAY['manual'::character varying, 'webhook'::character varying, 'schedule'::character varying, 'api'::character varying])::text[])))
);


--
-- Name: workflow_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_versions (
    id uuid NOT NULL,
    workflow_id uuid NOT NULL,
    version character varying(255) NOT NULL,
    definition json NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    changelog text,
    created_by uuid NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


--
-- Name: workflows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflows (
    id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    created_by uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    current_version_id uuid,
    settings json,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    CONSTRAINT workflows_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: failed_jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);


--
-- Name: jobs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: cache_locks cache_locks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);


--
-- Name: cache cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);


--
-- Name: failed_jobs failed_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);


--
-- Name: failed_jobs failed_jobs_uuid_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);


--
-- Name: job_batches job_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: step_runs step_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_runs
    ADD CONSTRAINT step_runs_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_unique UNIQUE (slug);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_tenant_id_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_email_unique UNIQUE (tenant_id, email);


--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_pkey PRIMARY KEY (id);


--
-- Name: webhooks webhooks_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_token_unique UNIQUE (token);


--
-- Name: workflow_runs workflow_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_pkey PRIMARY KEY (id);


--
-- Name: workflow_versions workflow_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_versions
    ADD CONSTRAINT workflow_versions_pkey PRIMARY KEY (id);


--
-- Name: workflow_versions workflow_versions_workflow_id_version_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_versions
    ADD CONSTRAINT workflow_versions_workflow_id_version_unique UNIQUE (workflow_id, version);


--
-- Name: workflows workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_pkey PRIMARY KEY (id);


--
-- Name: jobs_queue_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);


--
-- Name: schedules_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_is_active_index ON public.schedules USING btree (is_active);


--
-- Name: schedules_next_run_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_next_run_at_index ON public.schedules USING btree (next_run_at);


--
-- Name: schedules_tenant_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_tenant_id_index ON public.schedules USING btree (tenant_id);


--
-- Name: schedules_workflow_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_workflow_id_index ON public.schedules USING btree (workflow_id);


--
-- Name: schedules_workflow_version_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedules_workflow_version_id_index ON public.schedules USING btree (workflow_version_id);


--
-- Name: step_runs_next_retry_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_next_retry_at_index ON public.step_runs USING btree (next_retry_at);


--
-- Name: step_runs_node_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_node_id_index ON public.step_runs USING btree (node_id);


--
-- Name: step_runs_node_type_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_node_type_index ON public.step_runs USING btree (node_type);


--
-- Name: step_runs_sort_order_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_sort_order_index ON public.step_runs USING btree (sort_order);


--
-- Name: step_runs_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_status_index ON public.step_runs USING btree (status);


--
-- Name: step_runs_workflow_run_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_workflow_run_id_index ON public.step_runs USING btree (workflow_run_id);


--
-- Name: step_runs_workflow_run_id_sort_order_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_workflow_run_id_sort_order_index ON public.step_runs USING btree (workflow_run_id, sort_order);


--
-- Name: step_runs_workflow_run_id_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX step_runs_workflow_run_id_status_index ON public.step_runs USING btree (workflow_run_id, status);


--
-- Name: tenants_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_is_active_index ON public.tenants USING btree (is_active);


--
-- Name: users_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_is_active_index ON public.users USING btree (is_active);


--
-- Name: users_tenant_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_tenant_id_index ON public.users USING btree (tenant_id);


--
-- Name: webhooks_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhooks_is_active_index ON public.webhooks USING btree (is_active);


--
-- Name: webhooks_tenant_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhooks_tenant_id_index ON public.webhooks USING btree (tenant_id);


--
-- Name: webhooks_workflow_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX webhooks_workflow_id_index ON public.webhooks USING btree (workflow_id);


--
-- Name: workflow_runs_queue_job_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_queue_job_id_index ON public.workflow_runs USING btree (queue_job_id);


--
-- Name: workflow_runs_started_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_started_at_index ON public.workflow_runs USING btree (started_at);


--
-- Name: workflow_runs_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_status_index ON public.workflow_runs USING btree (status);


--
-- Name: workflow_runs_tenant_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_tenant_id_index ON public.workflow_runs USING btree (tenant_id);


--
-- Name: workflow_runs_tenant_id_status_started_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_tenant_id_status_started_at_index ON public.workflow_runs USING btree (tenant_id, status, started_at);


--
-- Name: workflow_runs_timeout_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_timeout_at_index ON public.workflow_runs USING btree (timeout_at);


--
-- Name: workflow_runs_triggered_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_triggered_by_index ON public.workflow_runs USING btree (triggered_by);


--
-- Name: workflow_runs_workflow_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_workflow_id_index ON public.workflow_runs USING btree (workflow_id);


--
-- Name: workflow_runs_workflow_id_started_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_workflow_id_started_at_index ON public.workflow_runs USING btree (workflow_id, started_at);


--
-- Name: workflow_runs_workflow_version_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_runs_workflow_version_id_index ON public.workflow_runs USING btree (workflow_version_id);


--
-- Name: workflow_versions_created_at_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_versions_created_at_index ON public.workflow_versions USING btree (created_at);


--
-- Name: workflow_versions_is_active_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_versions_is_active_index ON public.workflow_versions USING btree (is_active);


--
-- Name: workflow_versions_workflow_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflow_versions_workflow_id_index ON public.workflow_versions USING btree (workflow_id);


--
-- Name: workflows_created_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflows_created_by_index ON public.workflows USING btree (created_by);


--
-- Name: workflows_current_version_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflows_current_version_id_index ON public.workflows USING btree (current_version_id);


--
-- Name: workflows_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflows_status_index ON public.workflows USING btree (status);


--
-- Name: workflows_tenant_id_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workflows_tenant_id_index ON public.workflows USING btree (tenant_id);


--
-- Name: schedules schedules_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_workflow_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_workflow_id_foreign FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_workflow_version_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_workflow_version_id_foreign FOREIGN KEY (workflow_version_id) REFERENCES public.workflow_versions(id) ON DELETE CASCADE;


--
-- Name: step_runs step_runs_workflow_run_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.step_runs
    ADD CONSTRAINT step_runs_workflow_run_id_foreign FOREIGN KEY (workflow_run_id) REFERENCES public.workflow_runs(id) ON DELETE CASCADE;


--
-- Name: users users_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: webhooks webhooks_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: webhooks webhooks_workflow_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_workflow_id_foreign FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_triggered_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_triggered_by_foreign FOREIGN KEY (triggered_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: workflow_runs workflow_runs_workflow_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_workflow_id_foreign FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflow_runs workflow_runs_workflow_version_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_runs
    ADD CONSTRAINT workflow_runs_workflow_version_id_foreign FOREIGN KEY (workflow_version_id) REFERENCES public.workflow_versions(id) ON DELETE CASCADE;


--
-- Name: workflow_versions workflow_versions_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_versions
    ADD CONSTRAINT workflow_versions_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflow_versions workflow_versions_workflow_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_versions
    ADD CONSTRAINT workflow_versions_workflow_id_foreign FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_created_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_created_by_foreign FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workflows workflows_current_version_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_current_version_id_foreign FOREIGN KEY (current_version_id) REFERENCES public.workflow_versions(id) ON DELETE SET NULL;


--
-- Name: workflows workflows_tenant_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_tenant_id_foreign FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 7ilq4Nr9BDppcPuTPHmRD9SZ2fSbzDCu23rBkg8TF5E19927covUruW9vvekU2b

--
-- PostgreSQL database dump
--

\restrict EHuuwaBbXaAefg8SXXMiWZ7DYwSHe2JX0lCvdy1N9O3pI27JVhIwucyBInzLUG8

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.migrations (id, migration, batch) FROM stdin;
1	0001_01_01_000001_create_cache_table	1
2	0001_01_01_000002_create_jobs_table	1
3	2026_06_10_000001_create_tenants_table	1
4	2026_06_10_000002_create_users_table	1
5	2026_06_10_000003_create_workflows_table	1
6	2026_06_10_000004_create_workflow_versions_table	1
7	2026_06_10_000005_create_workflow_runs_table	1
8	2026_06_10_000006_create_step_runs_table	1
9	2026_06_10_000007_create_webhooks_table	1
10	2026_06_10_000008_create_schedules_table	1
11	2026_06_10_000009_add_workflows_current_version_foreign	1
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.migrations_id_seq', 11, true);


--
-- PostgreSQL database dump complete
--

\unrestrict EHuuwaBbXaAefg8SXXMiWZ7DYwSHe2JX0lCvdy1N9O3pI27JVhIwucyBInzLUG8

