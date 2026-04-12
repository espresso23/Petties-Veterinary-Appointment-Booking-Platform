--
-- PostgreSQL database dump
--

\restrict 2BAEYF3qFZyTHABANCQTGNJwG9P1Vei1Kek7SxiGHZ4QPlSfnRCZZKcCbXxsoIm

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: agenttype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agenttype AS ENUM (
    'MAIN',
    'BOOKING',
    'MEDICAL',
    'RESEARCH'
);


--
-- Name: settingcategory; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.settingcategory AS ENUM (
    'LLM',
    'RAG',
    'EMBEDDINGS',
    'VECTOR_DB',
    'GENERAL',
    'WEB_SEARCH'
);


--
-- Name: tooltype; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tooltype AS ENUM (
    'CODE_BASED',
    'API_BASED'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    temperature double precision,
    max_tokens integer,
    top_p double precision,
    model character varying(100),
    enabled boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: agents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agents_id_seq OWNED BY public.agents.id;


--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


--
-- Name: blacklisted_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blacklisted_tokens (
    created_at timestamp(6) without time zone NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    token_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL
);


--
-- Name: booking_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_services (
    booking_service_id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    service_id uuid NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    assigned_staff_id uuid,
    base_price numeric(12,2),
    weight_price numeric(12,2),
    distance_fee numeric(12,2),
    is_add_on boolean DEFAULT false,
    pet_id uuid
);


--
-- Name: COLUMN booking_services.assigned_staff_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_services.assigned_staff_id IS 'Assigned staff member for this specific service. Different services in the same booking can have different staff based on specialty.';


--
-- Name: COLUMN booking_services.base_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_services.base_price IS 'Original base price of the service';


--
-- Name: COLUMN booking_services.weight_price; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_services.weight_price IS 'Price tier based on pet weight';


--
-- Name: COLUMN booking_services.distance_fee; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.booking_services.distance_fee IS 'Home visit fee (pricePerKm × distanceKm)';


--
-- Name: booking_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_slots (
    booking_slot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    slot_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    booking_service_id uuid
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    booking_id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_code character varying(20) NOT NULL,
    pet_id uuid NOT NULL,
    pet_owner_id uuid NOT NULL,
    clinic_id uuid,
    assigned_staff_id uuid,
    booking_date date NOT NULL,
    booking_time time without time zone NOT NULL,
    type character varying(20) NOT NULL,
    home_address character varying(255),
    home_lat numeric(10,7),
    home_long numeric(10,7),
    distance_km numeric(5,2),
    total_price numeric(12,2) NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    cancellation_reason character varying(255),
    cancelled_by uuid,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    distance_fee numeric(12,2),
    sos_fee numeric(12,2),
    confirmed_at timestamp(6) without time zone,
    symptoms text,
    arrived_at timestamp(6) without time zone,
    version bigint DEFAULT 0 NOT NULL,
    proxy_booker_id uuid,
    payment_status character varying(20),
    payment_method character varying(20),
    discount_amount numeric(12,2),
    final_price numeric(12,2),
    voucher_id uuid,
    CONSTRAINT bookings_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'SEARCHING'::character varying, 'PENDING_CLINIC_CONFIRM'::character varying, 'CONFIRMED'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'CANCELLED'::character varying, 'NO_SHOW'::character varying])::text[]))),
    CONSTRAINT bookings_type_check CHECK (((type)::text = ANY ((ARRAY['IN_CLINIC'::character varying, 'HOME_VISIT'::character varying, 'SOS'::character varying])::text[])))
);


--
-- Name: COLUMN bookings.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.status IS 'Booking status without AWAITING_PAYMENT. Payment progress tracked by payment_status/payment_method.';


--
-- Name: COLUMN bookings.distance_fee; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.distance_fee IS 'Home visit fee applied once per booking (pricePerKm × distanceKm)';


--
-- Name: COLUMN bookings.proxy_booker_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.bookings.proxy_booker_id IS 'The user who created this booking on behalf of another person (proxy booking). NULL if the pet owner booked themselves.';


--
-- Name: chat_auto_reply_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_auto_reply_settings (
    setting_id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    quick_reply_enabled boolean DEFAULT true NOT NULL,
    quick_reply_message text,
    away_message_enabled boolean DEFAULT false NOT NULL,
    away_condition character varying(50) DEFAULT 'OFF_HOURS'::character varying NOT NULL,
    away_message text,
    action_buttons text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    session_id integer NOT NULL,
    role character varying(20) NOT NULL,
    content text NOT NULL,
    message_metadata json,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: chat_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_sessions (
    id integer NOT NULL,
    agent_id integer,
    user_id character varying(100),
    session_id character varying(100) NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone
);


--
-- Name: chat_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_sessions_id_seq OWNED BY public.chat_sessions.id;


--
-- Name: clinic_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_balances (
    clinic_balance_id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    current_balance numeric(19,2) DEFAULT 0 NOT NULL,
    total_withdrawn numeric(19,2) DEFAULT 0 NOT NULL,
    total_platform_fees numeric(19,2) DEFAULT 0 NOT NULL,
    total_transaction_fees numeric(19,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: clinic_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_images (
    display_order integer,
    is_primary boolean,
    created_at timestamp(6) without time zone NOT NULL,
    clinic_id uuid NOT NULL,
    image_id uuid NOT NULL,
    caption character varying(200),
    image_url character varying(500) NOT NULL
);


--
-- Name: clinic_price_per_km; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_price_per_km (
    price_per_km numeric(12,2),
    created_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    clinic_id uuid NOT NULL,
    sos_fee numeric(12,2),
    version bigint DEFAULT 0 NOT NULL
);


--
-- Name: clinic_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_services (
    base_price numeric(19,2) NOT NULL,
    duration_time integer NOT NULL,
    is_active boolean NOT NULL,
    is_custom boolean NOT NULL,
    is_home_visit boolean NOT NULL,
    slots_required integer NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone,
    clinic_id uuid NOT NULL,
    master_service_id uuid,
    service_id uuid NOT NULL,
    pet_type character varying(100),
    service_category character varying(100),
    name character varying(200) NOT NULL,
    description text,
    reminder_interval integer,
    reminder_unit character varying(50),
    vaccine_template_id uuid,
    version bigint DEFAULT 0
);


--
-- Name: COLUMN clinic_services.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clinic_services.description IS 'Service description for clinic-specific services';


--
-- Name: clinic_strike_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_strike_config (
    config_key character varying(100) NOT NULL,
    config_value character varying(255) NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid
);


--
-- Name: clinic_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinic_vouchers (
    clinic_voucher_id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    applied_by uuid,
    is_enabled boolean DEFAULT true NOT NULL,
    applied_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinics (
    latitude numeric(10,8),
    longitude numeric(11,8),
    rating_avg numeric(2,1),
    rating_count integer,
    approved_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    clinic_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    phone character varying(20) NOT NULL,
    district character varying(100),
    email character varying(100),
    province character varying(100),
    name character varying(200) NOT NULL,
    specific_location character varying(200),
    address character varying(500) NOT NULL,
    logo character varying(500),
    description text,
    rejection_reason text,
    status character varying(255) NOT NULL,
    operating_hours jsonb,
    ward character varying(100),
    business_license_url character varying(500),
    bank_name character varying(100),
    account_number character varying(50),
    version bigint DEFAULT 0,
    strike_until timestamp without time zone,
    CONSTRAINT clinics_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'SUSPENDED'::character varying])::text[])))
);


--
-- Name: COLUMN clinics.business_license_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clinics.business_license_url IS 'URL to business license/veterinary practice certificate uploaded to Cloudinary';


--
-- Name: COLUMN clinics.bank_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clinics.bank_name IS 'Tên ngân hàng của phòng khám';


--
-- Name: COLUMN clinics.account_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clinics.account_number IS 'Số tài khoản ngân hàng của phòng khám';


--
-- Name: COLUMN clinics.strike_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clinics.strike_until IS 'Thời điểm hết hạn strike. NULL = không bị strike. Khi có giá trị: clinic không nhận booking mới, không xuất hiện trong tìm kiếm.';


--
-- Name: disease_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disease_aliases (
    id integer NOT NULL,
    canonical_code character varying(100) NOT NULL,
    source_type character varying(50) NOT NULL,
    alias_text character varying(255) NOT NULL,
    normalized_alias character varying(255) NOT NULL,
    species character varying(50) DEFAULT 'all'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: disease_aliases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.disease_aliases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: disease_aliases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.disease_aliases_id_seq OWNED BY public.disease_aliases.id;


--
-- Name: disease_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.disease_catalog (
    id integer NOT NULL,
    canonical_code character varying(100) NOT NULL,
    display_name_vi character varying(255) NOT NULL,
    species character varying(50) DEFAULT 'all'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: disease_catalog_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.disease_catalog_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: disease_catalog_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.disease_catalog_id_seq OWNED BY public.disease_catalog.id;


--
-- Name: flyway_schema_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flyway_schema_history (
    installed_rank integer NOT NULL,
    version character varying(50),
    description character varying(200) NOT NULL,
    type character varying(20) NOT NULL,
    script character varying(1000) NOT NULL,
    checksum integer,
    installed_by character varying(100) NOT NULL,
    installed_on timestamp without time zone DEFAULT now() NOT NULL,
    execution_time integer NOT NULL,
    success boolean NOT NULL
);


--
-- Name: knowledge_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_documents (
    id integer NOT NULL,
    filename character varying(255) NOT NULL,
    file_path character varying(500) NOT NULL,
    file_type character varying(10),
    file_size integer,
    processed boolean,
    vector_count integer,
    uploaded_by character varying(100),
    notes text,
    uploaded_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    image_count integer DEFAULT 0
);


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.knowledge_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: knowledge_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.knowledge_documents_id_seq OWNED BY public.knowledge_documents.id;


--
-- Name: master_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_services (
    default_price numeric(19,2) NOT NULL,
    default_price_per_km numeric(19,2),
    duration_time integer NOT NULL,
    is_home_visit boolean NOT NULL,
    slots_required integer NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone,
    master_service_id uuid NOT NULL,
    icon character varying(100),
    pet_type character varying(100),
    service_category character varying(100),
    name character varying(200) NOT NULL,
    description text
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    read boolean NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    clinic_id uuid,
    notification_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    reason text,
    type character varying(255) NOT NULL,
    shift_id uuid,
    emr_id character varying(255),
    action_type character varying(255),
    action_data text,
    CONSTRAINT notifications_type_check CHECK (((type)::text = ANY (ARRAY['APPROVED'::text, 'REJECTED'::text, 'PENDING'::text, 'CLINIC_PENDING_APPROVAL'::text, 'CLINIC_VERIFIED'::text, 'CLINIC_STRIKE'::text, 'PET_OWNER_STRIKE'::text, 'STAFF_SHIFT_ASSIGNED'::text, 'STAFF_SHIFT_UPDATED'::text, 'STAFF_SHIFT_DELETED'::text, 'STAFF_ON_WAY'::text, 'STAFF_ARRIVED'::text, 'BOOKING_CREATED'::text, 'BOOKING_CONFIRMED'::text, 'BOOKING_ASSIGNED'::text, 'BOOKING_CANCELLED'::text, 'BOOKING_CHECKIN'::text, 'BOOKING_PAYMENT_REQUIRED'::text, 'BOOKING_COMPLETED'::text, 'BOOKING_REMINDER'::text, 'RE_EXAMINATION_REMINDER'::text, 'VACCINATION_REMINDER'::text, 'REPORT_CREATED'::text, 'REPORT_RESOLVED'::text, 'SYSTEM'::text, 'PROMOTION'::text, 'REFUND_REQUESTED'::text, 'REFUND_APPROVED'::text, 'REFUND_REJECTED'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid,
    amount numeric(12,2) NOT NULL,
    method character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    stripe_payment_id character varying(255),
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    payment_description character varying(100),
    subscription_id uuid,
    CONSTRAINT payments_method_check CHECK (((method)::text = ANY ((ARRAY['CASH'::character varying, 'QR'::character varying, 'CARD'::character varying])::text[]))),
    CONSTRAINT payments_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PAID'::character varying, 'REFUNDED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: pets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pets (
    date_of_birth date NOT NULL,
    weight double precision NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone,
    pet_id uuid NOT NULL,
    user_id uuid NOT NULL,
    breed character varying(255) NOT NULL,
    gender character varying(255) NOT NULL,
    image_public_id character varying(255),
    image_url character varying(255),
    name character varying(255) NOT NULL,
    color character varying(100),
    allergies text,
    deleted_at timestamp without time zone,
    species character varying(20) NOT NULL,
    CONSTRAINT chk_pet_species CHECK (((species)::text = ANY ((ARRAY['DOG'::character varying, 'CAT'::character varying, 'BIRD'::character varying, 'RABBIT'::character varying, 'HAMSTER'::character varying, 'FISH'::character varying, 'OTHER'::character varying])::text[])))
);


--
-- Name: COLUMN pets.color; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pets.color IS 'Pet fur/skin color (e.g., Brown, Black, White, Mixed)';


--
-- Name: COLUMN pets.allergies; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pets.allergies IS 'Known allergies of the pet (optional, free text)';


--
-- Name: COLUMN pets.deleted_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pets.deleted_at IS 'Soft delete timestamp - if not null, pet is considered deleted';


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    created_at timestamp(6) without time zone NOT NULL,
    expires_at timestamp(6) without time zone NOT NULL,
    token_id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL
);


--
-- Name: refund_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_applications (
    refund_application_id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    period_year_month character varying(7) NOT NULL,
    month_revenue numeric(19,2) NOT NULL,
    web_deduction_percent integer DEFAULT 5 NOT NULL,
    web_deduction_amount numeric(19,2) NOT NULL,
    amount_after_deduction numeric(19,2) NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    rejection_reason text,
    reviewed_by uuid,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    qr_revenue numeric(19,2) DEFAULT 0 NOT NULL,
    cash_revenue numeric(19,2) DEFAULT 0 NOT NULL,
    requested_amount numeric(19,2) DEFAULT 0 NOT NULL
);


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reported_clinic_id uuid,
    reported_user_id uuid,
    reason text NOT NULL,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    admin_note text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    attachment_urls jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: COLUMN reports.attachment_urls; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.reports.attachment_urls IS 'Array of HTTPS image URLs (e.g. Cloudinary), max 5 enforced in application layer';


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    review_id uuid NOT NULL,
    comment text,
    created_at timestamp(6) without time zone,
    rating integer NOT NULL,
    booking_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: service_weight_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_weight_prices (
    max_weight numeric(10,2) NOT NULL,
    min_weight numeric(10,2) NOT NULL,
    price numeric(19,2) NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone,
    master_service_id uuid,
    service_id uuid,
    weight_price_id uuid NOT NULL
);


--
-- Name: slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slots (
    slot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    shift_id uuid NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status character varying(20) DEFAULT 'AVAILABLE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    CONSTRAINT chk_slot_status CHECK (((status)::text = ANY ((ARRAY['AVAILABLE'::character varying, 'BOOKED'::character varying, 'BLOCKED'::character varying])::text[])))
);


--
-- Name: TABLE slots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.slots IS 'Bookable time slots - auto-generated from shifts';


--
-- Name: COLUMN slots.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.slots.status IS 'AVAILABLE=can book, BOOKED=has booking, BLOCKED=manually blocked';


--
-- Name: staff_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_shifts (
    shift_id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    work_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_start time without time zone,
    break_end time without time zone,
    notes character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone,
    is_overnight boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE staff_shifts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.staff_shifts IS 'Staff work shifts - each shift generates multiple 30-min slots';


--
-- Name: COLUMN staff_shifts.staff_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staff_shifts.staff_id IS 'Staff member ID (formerly vet_id)';


--
-- Name: COLUMN staff_shifts.break_start; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staff_shifts.break_start IS 'Optional break start time - slots not generated during break';


--
-- Name: COLUMN staff_shifts.break_end; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staff_shifts.break_end IS 'Optional break end time';


--
-- Name: COLUMN staff_shifts.is_overnight; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.staff_shifts.is_overnight IS 'If true, end_time is on the following day (e.g., 22:00 start -> 06:00 end next day)';


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    plan_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(12,2) NOT NULL,
    duration_days integer NOT NULL,
    features text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: system_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_notifications (
    id uuid NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(255) NOT NULL,
    target_audience character varying(255) NOT NULL,
    target_count integer NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    category public.settingcategory,
    is_sensitive boolean,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: tools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tools (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    tool_type public.tooltype,
    input_schema json,
    output_schema json,
    enabled boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


--
-- Name: tools_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tools_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tools_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tools_id_seq OWNED BY public.tools.id;


--
-- Name: user_strike_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_strike_config (
    config_key character varying(100) NOT NULL,
    config_value character varying(255) NOT NULL,
    description text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_by uuid
);


--
-- Name: user_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_subscriptions (
    subscription_id uuid NOT NULL,
    user_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status character varying(20) NOT NULL,
    payment_method character varying(20),
    start_date timestamp without time zone,
    end_date timestamp without time zone,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    created_at timestamp(6) without time zone NOT NULL,
    deleted_at timestamp(6) without time zone,
    updated_at timestamp(6) without time zone,
    user_id uuid NOT NULL,
    working_clinic_id uuid,
    phone character varying(20),
    role character varying(20) NOT NULL,
    username character varying(50) NOT NULL,
    avatar_public_id character varying(100),
    email character varying(100),
    full_name character varying(100),
    avatar character varying(500),
    password character varying(255) NOT NULL,
    fcm_token character varying(500),
    average_rating double precision,
    number_of_ratings integer,
    specialization character varying(100),
    specialty character varying(100),
    rating_avg numeric(2,1) DEFAULT 0.0,
    rating_count integer DEFAULT 0,
    address character varying(500),
    strike_until timestamp without time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['PET_OWNER'::character varying, 'STAFF'::character varying, 'CLINIC_MANAGER'::character varying, 'CLINIC_OWNER'::character varying, 'ADMIN'::character varying])::text[])))
);


--
-- Name: COLUMN users.address; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.address IS 'User address - used for Pet Owner home address in bookings';


--
-- Name: COLUMN users.strike_until; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.strike_until IS 'Thời điểm hết hạn strike. NULL = không bị strike. Khi có giá trị: pet owner không thể đặt lịch mới.';


--
-- Name: vaccine_dose_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vaccine_dose_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    service_id uuid NOT NULL,
    dose_number integer NOT NULL,
    dose_label character varying(50),
    price numeric(19,2) NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE vaccine_dose_prices; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.vaccine_dose_prices IS 'Giá vắc-xin theo số mũi tiêm. Clinic Owner cấu hình, Staff chọn khi tiêm.';


--
-- Name: COLUMN vaccine_dose_prices.dose_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccine_dose_prices.dose_number IS '1, 2, 3 cho series. 4 = annual booster';


--
-- Name: vaccine_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vaccine_templates (
    vaccine_template_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    manufacturer character varying(100),
    description text,
    default_price numeric(19,2),
    min_age_weeks integer,
    repeat_interval_days integer,
    series_doses integer,
    is_annual_repeat boolean DEFAULT false,
    target_species character varying(10) DEFAULT 'DOG'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone,
    min_interval_days integer DEFAULT 14,
    service_id uuid,
    CONSTRAINT chk_target_species CHECK (((target_species)::text = ANY ((ARRAY['DOG'::character varying, 'CAT'::character varying, 'BOTH'::character varying])::text[])))
);


--
-- Name: COLUMN vaccine_templates.min_interval_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.vaccine_templates.min_interval_days IS 'Minimum number of days required between doses for safety';


--
-- Name: vision_disease_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vision_disease_classes (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name_vi character varying(100) NOT NULL,
    description text,
    species character varying(50) DEFAULT 'all'::character varying,
    is_active boolean DEFAULT true,
    requires_retrain boolean DEFAULT false,
    label_count integer DEFAULT 0,
    min_label_required integer DEFAULT 50,
    model_version character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vision_disease_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vision_disease_classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vision_disease_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vision_disease_classes_id_seq OWNED BY public.vision_disease_classes.id;


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vouchers (
    voucher_id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(12,2) NOT NULL,
    max_discount_amount numeric(12,2),
    min_order_amount numeric(12,2) DEFAULT 0 NOT NULL,
    applicable_category character varying(100),
    used_count integer DEFAULT 0 NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    created_by uuid,
    require_online_payment boolean DEFAULT false NOT NULL,
    limit_one_per_user boolean DEFAULT false NOT NULL,
    CONSTRAINT vouchers_discount_type_check CHECK (((discount_type)::text = ANY ((ARRAY['PERCENTAGE'::character varying, 'FIXED_AMOUNT'::character varying])::text[])))
);


--
-- Name: withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.withdrawals (
    withdrawal_id uuid DEFAULT gen_random_uuid() NOT NULL,
    clinic_id uuid NOT NULL,
    refund_application_id uuid NOT NULL,
    requested_amount numeric(19,2) NOT NULL,
    transferred_amount numeric(19,2) NOT NULL,
    platform_fee numeric(19,2) NOT NULL,
    transaction_fee numeric(19,2) DEFAULT 0,
    admin_notes text,
    transfer_reference character varying(255),
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    approved_by uuid,
    approved_at timestamp without time zone,
    completed_at timestamp without time zone,
    failure_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: agents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents ALTER COLUMN id SET DEFAULT nextval('public.agents_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: chat_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions ALTER COLUMN id SET DEFAULT nextval('public.chat_sessions_id_seq'::regclass);


--
-- Name: disease_aliases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disease_aliases ALTER COLUMN id SET DEFAULT nextval('public.disease_aliases_id_seq'::regclass);


--
-- Name: disease_catalog id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disease_catalog ALTER COLUMN id SET DEFAULT nextval('public.disease_catalog_id_seq'::regclass);


--
-- Name: knowledge_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents ALTER COLUMN id SET DEFAULT nextval('public.knowledge_documents_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: tools id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tools ALTER COLUMN id SET DEFAULT nextval('public.tools_id_seq'::regclass);


--
-- Name: vision_disease_classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vision_disease_classes ALTER COLUMN id SET DEFAULT nextval('public.vision_disease_classes_id_seq'::regclass);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: blacklisted_tokens blacklisted_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklisted_tokens
    ADD CONSTRAINT blacklisted_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: blacklisted_tokens blacklisted_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blacklisted_tokens
    ADD CONSTRAINT blacklisted_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: booking_services booking_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_pkey PRIMARY KEY (booking_service_id);


--
-- Name: booking_slots booking_slots_booking_id_slot_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_booking_id_slot_id_key UNIQUE (booking_id, slot_id);


--
-- Name: booking_slots booking_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_pkey PRIMARY KEY (booking_slot_id);


--
-- Name: bookings bookings_booking_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_booking_code_key UNIQUE (booking_code);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (booking_id);


--
-- Name: chat_auto_reply_settings chat_auto_reply_settings_clinic_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_auto_reply_settings
    ADD CONSTRAINT chat_auto_reply_settings_clinic_id_key UNIQUE (clinic_id);


--
-- Name: chat_auto_reply_settings chat_auto_reply_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_auto_reply_settings
    ADD CONSTRAINT chat_auto_reply_settings_pkey PRIMARY KEY (setting_id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_sessions chat_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_pkey PRIMARY KEY (id);


--
-- Name: clinic_balances clinic_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_balances
    ADD CONSTRAINT clinic_balances_pkey PRIMARY KEY (clinic_balance_id);


--
-- Name: clinic_images clinic_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_images
    ADD CONSTRAINT clinic_images_pkey PRIMARY KEY (image_id);


--
-- Name: clinic_price_per_km clinic_price_per_km_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_price_per_km
    ADD CONSTRAINT clinic_price_per_km_pkey PRIMARY KEY (clinic_id);


--
-- Name: clinic_services clinic_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_pkey PRIMARY KEY (service_id);


--
-- Name: clinic_strike_config clinic_strike_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_strike_config
    ADD CONSTRAINT clinic_strike_config_pkey PRIMARY KEY (config_key);


--
-- Name: clinic_vouchers clinic_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_vouchers
    ADD CONSTRAINT clinic_vouchers_pkey PRIMARY KEY (clinic_voucher_id);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (clinic_id);


--
-- Name: disease_aliases disease_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disease_aliases
    ADD CONSTRAINT disease_aliases_pkey PRIMARY KEY (id);


--
-- Name: disease_catalog disease_catalog_canonical_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disease_catalog
    ADD CONSTRAINT disease_catalog_canonical_code_key UNIQUE (canonical_code);


--
-- Name: disease_catalog disease_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disease_catalog
    ADD CONSTRAINT disease_catalog_pkey PRIMARY KEY (id);


--
-- Name: flyway_schema_history flyway_schema_history_pk; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flyway_schema_history
    ADD CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank);


--
-- Name: knowledge_documents knowledge_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_documents
    ADD CONSTRAINT knowledge_documents_pkey PRIMARY KEY (id);


--
-- Name: master_services master_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_services
    ADD CONSTRAINT master_services_pkey PRIMARY KEY (master_service_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: payments payments_booking_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_key UNIQUE (booking_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- Name: pets pets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT pets_pkey PRIMARY KEY (pet_id);


--
-- Name: vaccine_templates pk_vaccine_templates; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccine_templates
    ADD CONSTRAINT pk_vaccine_templates PRIMARY KEY (vaccine_template_id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: refund_applications refund_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_applications
    ADD CONSTRAINT refund_applications_pkey PRIMARY KEY (refund_application_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (review_id);


--
-- Name: service_weight_prices service_weight_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_weight_prices
    ADD CONSTRAINT service_weight_prices_pkey PRIMARY KEY (weight_price_id);


--
-- Name: slots slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slots
    ADD CONSTRAINT slots_pkey PRIMARY KEY (slot_id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (plan_id);


--
-- Name: system_notifications system_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_notifications
    ADD CONSTRAINT system_notifications_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tools tools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tools
    ADD CONSTRAINT tools_pkey PRIMARY KEY (id);


--
-- Name: reviews uk3p9j9vyr1qofbcxju65es206r; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT uk3p9j9vyr1qofbcxju65es206r UNIQUE (booking_id);


--
-- Name: users uk6dotkott2kjsp8vw4d0m25fb7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk6dotkott2kjsp8vw4d0m25fb7 UNIQUE (email);


--
-- Name: clinic_balances uk_clinic_balance_clinic; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_balances
    ADD CONSTRAINT uk_clinic_balance_clinic UNIQUE (clinic_id);


--
-- Name: vaccine_dose_prices uke3lw2nkh1ckr9ip831lxv02qc; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccine_dose_prices
    ADD CONSTRAINT uke3lw2nkh1ckr9ip831lxv02qc UNIQUE (service_id, dose_number);


--
-- Name: users ukr43af9ap4edm43mmtq01oddj6; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT ukr43af9ap4edm43mmtq01oddj6 UNIQUE (username);


--
-- Name: clinic_vouchers ukvuiay6h7ytjatps5d0wdmuv3; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_vouchers
    ADD CONSTRAINT ukvuiay6h7ytjatps5d0wdmuv3 UNIQUE (voucher_id, clinic_id);


--
-- Name: staff_shifts unique_staff_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT unique_staff_date UNIQUE (staff_id, work_date);


--
-- Name: clinic_vouchers uq_clinic_voucher; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_vouchers
    ADD CONSTRAINT uq_clinic_voucher UNIQUE (voucher_id, clinic_id);


--
-- Name: disease_aliases uq_disease_alias_source_normalized_species; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disease_aliases
    ADD CONSTRAINT uq_disease_alias_source_normalized_species UNIQUE (source_type, normalized_alias, species);


--
-- Name: user_strike_config user_strike_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_strike_config
    ADD CONSTRAINT user_strike_config_pkey PRIMARY KEY (config_key);


--
-- Name: user_subscriptions user_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_pkey PRIMARY KEY (subscription_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: vaccine_dose_prices vaccine_dose_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccine_dose_prices
    ADD CONSTRAINT vaccine_dose_prices_pkey PRIMARY KEY (id);


--
-- Name: vaccine_dose_prices vaccine_dose_prices_service_id_dose_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccine_dose_prices
    ADD CONSTRAINT vaccine_dose_prices_service_id_dose_number_key UNIQUE (service_id, dose_number);


--
-- Name: staff_shifts vet_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT vet_shifts_pkey PRIMARY KEY (shift_id);


--
-- Name: vision_disease_classes vision_disease_classes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vision_disease_classes
    ADD CONSTRAINT vision_disease_classes_code_key UNIQUE (code);


--
-- Name: vision_disease_classes vision_disease_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vision_disease_classes
    ADD CONSTRAINT vision_disease_classes_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_code_key UNIQUE (code);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (voucher_id);


--
-- Name: withdrawals withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (withdrawal_id);


--
-- Name: flyway_schema_history_s_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flyway_schema_history_s_idx ON public.flyway_schema_history USING btree (success);


--
-- Name: idx_blacklisted_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blacklisted_tokens_token_hash ON public.blacklisted_tokens USING btree (token_hash);


--
-- Name: idx_blacklisted_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blacklisted_tokens_user_id ON public.blacklisted_tokens USING btree (user_id);


--
-- Name: idx_booking_services_assigned_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_services_assigned_staff ON public.booking_services USING btree (assigned_staff_id);


--
-- Name: idx_booking_services_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_services_booking_id ON public.booking_services USING btree (booking_id);


--
-- Name: idx_booking_services_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_services_service_id ON public.booking_services USING btree (service_id);


--
-- Name: idx_booking_slots_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_booking_id ON public.booking_slots USING btree (booking_id);


--
-- Name: idx_booking_slots_booking_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_booking_service ON public.booking_slots USING btree (booking_service_id);


--
-- Name: idx_booking_slots_slot_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_slots_slot_id ON public.booking_slots USING btree (slot_id);


--
-- Name: idx_bookings_assigned_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_assigned_staff_id ON public.bookings USING btree (assigned_staff_id);


--
-- Name: idx_bookings_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_clinic_id ON public.bookings USING btree (clinic_id);


--
-- Name: idx_bookings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_date ON public.bookings USING btree (booking_date);


--
-- Name: idx_bookings_pet_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_pet_id ON public.bookings USING btree (pet_id);


--
-- Name: idx_bookings_pet_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_pet_owner_id ON public.bookings USING btree (pet_owner_id);


--
-- Name: idx_bookings_proxy_booker_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_proxy_booker_id ON public.bookings USING btree (proxy_booker_id);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- Name: idx_chat_auto_reply_settings_clinic_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_auto_reply_settings_clinic_id ON public.chat_auto_reply_settings USING btree (clinic_id);


--
-- Name: idx_clinic_balance_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_balance_clinic ON public.clinic_balances USING btree (clinic_id);


--
-- Name: idx_clinic_services_vaccine_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_services_vaccine_template ON public.clinic_services USING btree (vaccine_template_id);


--
-- Name: idx_clinic_vouchers_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_vouchers_clinic ON public.clinic_vouchers USING btree (clinic_id);


--
-- Name: idx_clinic_vouchers_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clinic_vouchers_voucher ON public.clinic_vouchers USING btree (voucher_id);


--
-- Name: idx_notification_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_read ON public.notifications USING btree (read);


--
-- Name: idx_notification_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_shift ON public.notifications USING btree (shift_id);


--
-- Name: idx_notification_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_type ON public.notifications USING btree (type);


--
-- Name: idx_notification_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_user ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_emr_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_emr_id ON public.notifications USING btree (emr_id);


--
-- Name: idx_payments_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_booking_id ON public.payments USING btree (booking_id);


--
-- Name: idx_payments_payment_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_payment_description ON public.payments USING btree (payment_description);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: idx_payments_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_subscription_id ON public.payments USING btree (subscription_id);


--
-- Name: idx_pets_deleted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pets_deleted_at ON public.pets USING btree (deleted_at);


--
-- Name: idx_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);


--
-- Name: idx_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);


--
-- Name: idx_refund_app_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_app_clinic ON public.refund_applications USING btree (clinic_id);


--
-- Name: idx_refund_app_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_app_created ON public.refund_applications USING btree (created_at);


--
-- Name: idx_refund_app_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refund_app_status ON public.refund_applications USING btree (status);


--
-- Name: idx_reports_booking_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_booking_id ON public.reports USING btree (booking_id);


--
-- Name: idx_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_status ON public.reports USING btree (status);


--
-- Name: idx_shift_clinic_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_clinic_date ON public.staff_shifts USING btree (clinic_id, work_date);


--
-- Name: idx_shift_staff_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_shift_staff_date ON public.staff_shifts USING btree (staff_id, work_date);


--
-- Name: idx_slot_shift; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_shift ON public.slots USING btree (shift_id);


--
-- Name: idx_slot_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_status ON public.slots USING btree (status);


--
-- Name: idx_slot_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_time ON public.slots USING btree (start_time, end_time);


--
-- Name: idx_system_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_notifications_created_at ON public.system_notifications USING btree (created_at DESC);


--
-- Name: idx_user_subscriptions_clinic_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_subscriptions_clinic_status ON public.user_subscriptions USING btree (clinic_id, status);


--
-- Name: idx_users_address; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_address ON public.users USING btree (address) WHERE (address IS NOT NULL);


--
-- Name: idx_users_fcm_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_fcm_token ON public.users USING btree (fcm_token) WHERE (fcm_token IS NOT NULL);


--
-- Name: idx_users_specialty; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_specialty ON public.users USING btree (specialty) WHERE (specialty IS NOT NULL);


--
-- Name: idx_vaccine_dose_prices_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vaccine_dose_prices_service ON public.vaccine_dose_prices USING btree (service_id);


--
-- Name: idx_vision_disease_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vision_disease_active ON public.vision_disease_classes USING btree (is_active);


--
-- Name: idx_vision_disease_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_vision_disease_code ON public.vision_disease_classes USING btree (code);


--
-- Name: idx_vouchers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_active ON public.vouchers USING btree (is_active);


--
-- Name: idx_vouchers_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_code ON public.vouchers USING btree (code);


--
-- Name: idx_vouchers_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_dates ON public.vouchers USING btree (start_date, end_date);


--
-- Name: idx_withdrawal_clinic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_clinic ON public.withdrawals USING btree (clinic_id);


--
-- Name: idx_withdrawal_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_created ON public.withdrawals USING btree (created_at);


--
-- Name: idx_withdrawal_refund_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_refund_app ON public.withdrawals USING btree (refund_application_id);


--
-- Name: idx_withdrawal_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_withdrawal_status ON public.withdrawals USING btree (status);


--
-- Name: ix_agents_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_agents_id ON public.agents USING btree (id);


--
-- Name: ix_agents_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_agents_name ON public.agents USING btree (name);


--
-- Name: ix_chat_messages_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_messages_id ON public.chat_messages USING btree (id);


--
-- Name: ix_chat_sessions_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_sessions_id ON public.chat_sessions USING btree (id);


--
-- Name: ix_chat_sessions_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_chat_sessions_session_id ON public.chat_sessions USING btree (session_id);


--
-- Name: ix_chat_sessions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_chat_sessions_user_id ON public.chat_sessions USING btree (user_id);


--
-- Name: ix_disease_aliases_canonical_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_disease_aliases_canonical_code ON public.disease_aliases USING btree (canonical_code);


--
-- Name: ix_disease_aliases_normalized_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_disease_aliases_normalized_alias ON public.disease_aliases USING btree (normalized_alias);


--
-- Name: ix_disease_aliases_source_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_disease_aliases_source_type ON public.disease_aliases USING btree (source_type);


--
-- Name: ix_disease_catalog_canonical_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_disease_catalog_canonical_code ON public.disease_catalog USING btree (canonical_code);


--
-- Name: ix_knowledge_documents_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_knowledge_documents_id ON public.knowledge_documents USING btree (id);


--
-- Name: ix_system_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_system_settings_key ON public.system_settings USING btree (key);


--
-- Name: ix_tools_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_tools_id ON public.tools USING btree (id);


--
-- Name: ix_tools_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_tools_name ON public.tools USING btree (name);


--
-- Name: unique_active_booking_per_pet_time; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_active_booking_per_pet_time ON public.bookings USING btree (pet_id, clinic_id, booking_date, booking_time) WHERE (((status)::text <> ALL (ARRAY[('CANCELLED'::character varying)::text, ('NO_SHOW'::character varying)::text])) AND ((type)::text = 'IN_CLINIC'::text));


--
-- Name: INDEX unique_active_booking_per_pet_time; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.unique_active_booking_per_pet_time IS 'Prevents duplicate active IN_CLINIC bookings for same pet at same time. Does not apply to SOS bookings.';


--
-- Name: unique_active_sos_booking_per_pet; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_active_sos_booking_per_pet ON public.bookings USING btree (pet_id, booking_date, booking_time) WHERE (((type)::text = 'SOS'::text) AND ((status)::text = ANY (ARRAY[('SEARCHING'::character varying)::text, ('PENDING_CLINIC_CONFIRM'::character varying)::text, ('CONFIRMED'::character varying)::text, ('ON_THE_WAY'::character varying)::text, ('ARRIVED'::character varying)::text, ('IN_PROGRESS'::character varying)::text])));


--
-- Name: INDEX unique_active_sos_booking_per_pet; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON INDEX public.unique_active_sos_booking_per_pet IS 'Ensures BR-62: Pet Owner cannot have multiple active SOS bookings.';


--
-- Name: booking_services booking_services_assigned_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: booking_services booking_services_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id) ON DELETE CASCADE;


--
-- Name: booking_services booking_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.clinic_services(service_id);


--
-- Name: booking_slots booking_slots_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id) ON DELETE CASCADE;


--
-- Name: booking_slots booking_slots_booking_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_booking_service_id_fkey FOREIGN KEY (booking_service_id) REFERENCES public.booking_services(booking_service_id);


--
-- Name: booking_slots booking_slots_slot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_slots
    ADD CONSTRAINT booking_slots_slot_id_fkey FOREIGN KEY (slot_id) REFERENCES public.slots(slot_id);


--
-- Name: bookings bookings_assigned_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: bookings bookings_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: bookings bookings_pet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pets(pet_id);


--
-- Name: bookings bookings_pet_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pet_owner_id_fkey FOREIGN KEY (pet_owner_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: bookings bookings_proxy_booker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_proxy_booker_id_fkey FOREIGN KEY (proxy_booker_id) REFERENCES public.users(user_id);


--
-- Name: chat_auto_reply_settings chat_auto_reply_settings_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_auto_reply_settings
    ADD CONSTRAINT chat_auto_reply_settings_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id);


--
-- Name: chat_sessions chat_sessions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_sessions
    ADD CONSTRAINT chat_sessions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id);


--
-- Name: clinic_balances clinic_balances_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_balances
    ADD CONSTRAINT clinic_balances_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id) ON DELETE CASCADE;


--
-- Name: clinic_services clinic_services_vaccine_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT clinic_services_vaccine_template_id_fkey FOREIGN KEY (vaccine_template_id) REFERENCES public.vaccine_templates(vaccine_template_id);


--
-- Name: clinic_strike_config clinic_strike_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_strike_config
    ADD CONSTRAINT clinic_strike_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id);


--
-- Name: clinic_vouchers clinic_vouchers_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_vouchers
    ADD CONSTRAINT clinic_vouchers_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: clinic_vouchers clinic_vouchers_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_vouchers
    ADD CONSTRAINT clinic_vouchers_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id) ON DELETE CASCADE;


--
-- Name: clinic_vouchers clinic_vouchers_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_vouchers
    ADD CONSTRAINT clinic_vouchers_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(voucher_id) ON DELETE CASCADE;


--
-- Name: disease_aliases disease_aliases_canonical_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.disease_aliases
    ADD CONSTRAINT disease_aliases_canonical_code_fkey FOREIGN KEY (canonical_code) REFERENCES public.disease_catalog(canonical_code) ON DELETE CASCADE;


--
-- Name: reviews fk28an517hrxtt2bsg93uefugrm; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fk28an517hrxtt2bsg93uefugrm FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id);


--
-- Name: booking_services fk3oortjfjgg8a5xn9hy7ejm92t; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT fk3oortjfjgg8a5xn9hy7ejm92t FOREIGN KEY (pet_id) REFERENCES public.pets(pet_id);


--
-- Name: service_weight_prices fk3ub4jvdf8a93p46qloxbo6a4r; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_weight_prices
    ADD CONSTRAINT fk3ub4jvdf8a93p46qloxbo6a4r FOREIGN KEY (master_service_id) REFERENCES public.master_services(master_service_id);


--
-- Name: service_weight_prices fk47bwjo0m1m7nvux0y0n88srsb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_weight_prices
    ADD CONSTRAINT fk47bwjo0m1m7nvux0y0n88srsb FOREIGN KEY (service_id) REFERENCES public.clinic_services(service_id);


--
-- Name: clinic_services fk4weu3k0vdc9s00pnlgj4qelor; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT fk4weu3k0vdc9s00pnlgj4qelor FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: clinic_price_per_km fk6aby0pdlrioq3uurswq61xsr9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_price_per_km
    ADD CONSTRAINT fk6aby0pdlrioq3uurswq61xsr9 FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: clinics fk7vqvtjkp82eqmdwxomal58gwo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT fk7vqvtjkp82eqmdwxomal58gwo FOREIGN KEY (owner_id) REFERENCES public.users(user_id);


--
-- Name: bookings fk8h9cuge8sldba6jettn8op94m; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT fk8h9cuge8sldba6jettn8op94m FOREIGN KEY (voucher_id) REFERENCES public.vouchers(voucher_id);


--
-- Name: notifications fk9y21adhxn0ayjhfocscqox7bh; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk9y21adhxn0ayjhfocscqox7bh FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: clinics fk_clinics_owner; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT fk_clinics_owner FOREIGN KEY (owner_id) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: notifications fk_notification_shift; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notification_shift FOREIGN KEY (shift_id) REFERENCES public.staff_shifts(shift_id) ON DELETE SET NULL;


--
-- Name: notifications fk_notifications_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: payments fk_payment_subscription; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT fk_payment_subscription FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(subscription_id);


--
-- Name: pets fk_pets_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT fk_pets_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_subscriptions fk_subscription_clinic; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT fk_subscription_clinic FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: user_subscriptions fk_subscription_plan; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT fk_subscription_plan FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(plan_id);


--
-- Name: user_subscriptions fk_subscription_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_subscriptions
    ADD CONSTRAINT fk_subscription_user FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: system_notifications fk_system_notifications_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_notifications
    ADD CONSTRAINT fk_system_notifications_created_by FOREIGN KEY (created_by) REFERENCES public.users(user_id);


--
-- Name: pets fkc47kjb41qf50bwgddm024m5xn; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pets
    ADD CONSTRAINT fkc47kjb41qf50bwgddm024m5xn FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: reviews fkcgy7qjc1r99dp117y9en6lxye; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fkcgy7qjc1r99dp117y9en6lxye FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: clinic_images fkg9ed4yxgx3d9ooe6s7o086b64; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_images
    ADD CONSTRAINT fkg9ed4yxgx3d9ooe6s7o086b64 FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: reviews fkhqrtnrd0lrdonk7kpe4tcrabw; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT fkhqrtnrd0lrdonk7kpe4tcrabw FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: clinic_services fkj9sk7nxisv38odi0sretnfceh; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinic_services
    ADD CONSTRAINT fkj9sk7nxisv38odi0sretnfceh FOREIGN KEY (master_service_id) REFERENCES public.master_services(master_service_id);


--
-- Name: notifications fkmlaes9dk5y9jk5u7lbu3htwv9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT fkmlaes9dk5y9jk5u7lbu3htwv9 FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: users fkp4gym5dq72b5eap6ui9513osc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fkp4gym5dq72b5eap6ui9513osc FOREIGN KEY (working_clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id) ON DELETE CASCADE;


--
-- Name: refund_applications refund_applications_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_applications
    ADD CONSTRAINT refund_applications_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id) ON DELETE CASCADE;


--
-- Name: refund_applications refund_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_applications
    ADD CONSTRAINT refund_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id);


--
-- Name: reports reports_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(booking_id);


--
-- Name: reports reports_reported_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_clinic_id_fkey FOREIGN KEY (reported_clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: reports reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(user_id);


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(user_id);


--
-- Name: slots slots_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slots
    ADD CONSTRAINT slots_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.staff_shifts(shift_id) ON DELETE CASCADE;


--
-- Name: staff_shifts staff_shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT staff_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: user_strike_config user_strike_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_strike_config
    ADD CONSTRAINT user_strike_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(user_id);


--
-- Name: vaccine_dose_prices vaccine_dose_prices_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccine_dose_prices
    ADD CONSTRAINT vaccine_dose_prices_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.clinic_services(service_id) ON DELETE CASCADE;


--
-- Name: vaccine_templates vaccine_templates_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccine_templates
    ADD CONSTRAINT vaccine_templates_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.clinic_services(service_id);


--
-- Name: staff_shifts vet_shifts_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_shifts
    ADD CONSTRAINT vet_shifts_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id);


--
-- Name: vouchers vouchers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(user_id) ON DELETE SET NULL;


--
-- Name: withdrawals withdrawals_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(user_id);


--
-- Name: withdrawals withdrawals_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(clinic_id) ON DELETE CASCADE;


--
-- Name: withdrawals withdrawals_refund_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_refund_application_id_fkey FOREIGN KEY (refund_application_id) REFERENCES public.refund_applications(refund_application_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 2BAEYF3qFZyTHABANCQTGNJwG9P1Vei1Kek7SxiGHZ4QPlSfnRCZZKcCbXxsoIm

