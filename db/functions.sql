                                                             ?column?                                                             
----------------------------------------------------------------------------------------------------------------------------------
 CREATE OR REPLACE FUNCTION public.armor(bytea)                                                                                  +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_armor$function$                                                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.armor(bytea, text[], text[])                                                                  +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_armor$function$                                                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.crypt(text, text)                                                                             +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_crypt$function$                                                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.dearmor(text)                                                                                 +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_dearmor$function$                                                                           +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.decrypt(bytea, bytea, text)                                                                   +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_decrypt$function$                                                                           +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.decrypt_iv(bytea, bytea, bytea, text)                                                         +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_decrypt_iv$function$                                                                        +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.digest(bytea, text)                                                                           +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_digest$function$                                                                            +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.digest(text, text)                                                                            +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_digest$function$                                                                            +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.encrypt(bytea, bytea, text)                                                                   +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_encrypt$function$                                                                           +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.encrypt_iv(bytea, bytea, bytea, text)                                                         +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_encrypt_iv$function$                                                                        +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.enforce_visit_assignment()                                                                    +
  RETURNS trigger                                                                                                                +
  LANGUAGE plpgsql                                                                                                               +
 AS $function$                                                                                                                   +
 BEGIN                                                                                                                           +
   IF NEW.inmate_id IS NOT NULL AND NEW.created_by IS NOT NULL THEN                                                              +
     IF NOT EXISTS (                                                                                                             +
       SELECT 1                                                                                                                  +
         FROM user_inmates ui                                                                                                    +
        WHERE ui.user_id = NEW.created_by                                                                                        +
          AND ui.inmate_id = NEW.inmate_id                                                                                       +
     ) THEN                                                                                                                      +
       RAISE EXCEPTION 'El usuario % no está autorizado para el interno %',                                                      +
         NEW.created_by, NEW.inmate_id                                                                                           +
         USING ERRCODE = '23514';                                                                                                +
     END IF;                                                                                                                     +
   END IF;                                                                                                                       +
   RETURN NEW;                                                                                                                   +
 END $function$                                                                                                                  +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gen_random_bytes(integer)                                                                     +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pg_random_bytes$function$                                                                      +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gen_random_uuid()                                                                             +
  RETURNS uuid                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE                                                                                                                  +
 AS '$libdir/pgcrypto', $function$pg_random_uuid$function$                                                                       +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gen_salt(text)                                                                                +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pg_gen_salt$function$                                                                          +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gen_salt(text, integer)                                                                       +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pg_gen_salt_rounds$function$                                                                   +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gin_extract_query_trgm(text, internal, smallint, internal, internal, internal, internal)      +
  RETURNS internal                                                                                                               +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gin_extract_query_trgm$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gin_extract_value_trgm(text, internal)                                                        +
  RETURNS internal                                                                                                               +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gin_extract_value_trgm$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gin_trgm_consistent(internal, smallint, text, integer, internal, internal, internal, internal)+
  RETURNS boolean                                                                                                                +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gin_trgm_consistent$function$                                                                   +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gin_trgm_triconsistent(internal, smallint, text, integer, internal, internal, internal)       +
  RETURNS "char"                                                                                                                 +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gin_trgm_triconsistent$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_compress(internal)                                                                      +
  RETURNS internal                                                                                                               +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_compress$function$                                                                        +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_consistent(internal, text, smallint, oid, internal)                                     +
  RETURNS boolean                                                                                                                +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_consistent$function$                                                                      +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_decompress(internal)                                                                    +
  RETURNS internal                                                                                                               +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_decompress$function$                                                                      +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_distance(internal, text, smallint, oid, internal)                                       +
  RETURNS double precision                                                                                                       +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_distance$function$                                                                        +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_in(cstring)                                                                             +
  RETURNS gtrgm                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_in$function$                                                                              +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_options(internal)                                                                       +
  RETURNS void                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE                                                                                                        +
 AS '$libdir/pg_trgm', $function$gtrgm_options$function$                                                                         +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_out(gtrgm)                                                                              +
  RETURNS cstring                                                                                                                +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_out$function$                                                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_penalty(internal, internal, internal)                                                   +
  RETURNS internal                                                                                                               +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_penalty$function$                                                                         +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_picksplit(internal, internal)                                                           +
  RETURNS internal                                                                                                               +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_picksplit$function$                                                                       +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_same(gtrgm, gtrgm, internal)                                                            +
  RETURNS internal                                                                                                               +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_same$function$                                                                            +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.gtrgm_union(internal, internal)                                                               +
  RETURNS gtrgm                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$gtrgm_union$function$                                                                           +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.hmac(bytea, bytea, text)                                                                      +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_hmac$function$                                                                              +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.hmac(text, text, text)                                                                        +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pg_hmac$function$                                                                              +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_armor_headers(text, OUT key text, OUT value text)                                         +
  RETURNS SETOF record                                                                                                           +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_armor_headers$function$                                                                    +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_key_id(bytea)                                                                             +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_key_id_w$function$                                                                         +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea)                                                                 +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text)                                                           +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt(bytea, bytea, text, text)                                                     +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea)                                                           +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text)                                                     +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_decrypt_bytea(bytea, bytea, text, text)                                               +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_pub_decrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea)                                                                  +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt(text, bytea, text)                                                            +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea)                                                           +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_pub_encrypt_bytea(bytea, bytea, text)                                                     +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_pub_encrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text)                                                                  +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt(bytea, text, text)                                                            +
  RETURNS text                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text)                                                            +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_decrypt_bytea(bytea, text, text)                                                      +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pgcrypto', $function$pgp_sym_decrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text)                                                                   +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt(text, text, text)                                                             +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_text$function$                                                                 +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text)                                                            +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.pgp_sym_encrypt_bytea(bytea, text, text)                                                      +
  RETURNS bytea                                                                                                                  +
  LANGUAGE c                                                                                                                     +
  PARALLEL SAFE STRICT                                                                                                           +
 AS '$libdir/pgcrypto', $function$pgp_sym_encrypt_bytea$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.set_limit(real)                                                                               +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  STRICT                                                                                                                         +
 AS '$libdir/pg_trgm', $function$set_limit$function$                                                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.set_updated_at()                                                                              +
  RETURNS trigger                                                                                                                +
  LANGUAGE plpgsql                                                                                                               +
 AS $function$                                                                                                                   +
 BEGIN                                                                                                                           +
   NEW.updated_at := now();                                                                                                      +
   RETURN NEW;                                                                                                                   +
 END                                                                                                                             +
 $function$                                                                                                                      +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.set_updated_at_inmates()                                                                      +
  RETURNS trigger                                                                                                                +
  LANGUAGE plpgsql                                                                                                               +
 AS $function$                                                                                                                   +
 BEGIN                                                                                                                           +
   NEW.updated_at := now();                                                                                                      +
   RETURN NEW;                                                                                                                   +
 END $function$                                                                                                                  +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.set_visit_short_code()                                                                        +
  RETURNS trigger                                                                                                                +
  LANGUAGE plpgsql                                                                                                               +
 AS $function$                                                                                                                   +
 BEGIN                                                                                                                           +
   IF NEW.short_code IS NULL THEN                                                                                                +
     NEW.short_code := substr(NEW.id::text, 1, 8);                                                                               +
   END IF;                                                                                                                       +
   RETURN NEW;                                                                                                                   +
 END $function$                                                                                                                  +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.show_limit()                                                                                  +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  STABLE PARALLEL SAFE STRICT                                                                                                    +
 AS '$libdir/pg_trgm', $function$show_limit$function$                                                                            +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.show_trgm(text)                                                                               +
  RETURNS text[]                                                                                                                 +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$show_trgm$function$                                                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.similarity(text, text)                                                                        +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$similarity$function$                                                                            +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.similarity_dist(text, text)                                                                   +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$similarity_dist$function$                                                                       +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.similarity_op(text, text)                                                                     +
  RETURNS boolean                                                                                                                +
  LANGUAGE c                                                                                                                     +
  STABLE PARALLEL SAFE STRICT                                                                                                    +
 AS '$libdir/pg_trgm', $function$similarity_op$function$                                                                         +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.strict_word_similarity(text, text)                                                            +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$strict_word_similarity$function$                                                                +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.strict_word_similarity_commutator_op(text, text)                                              +
  RETURNS boolean                                                                                                                +
  LANGUAGE c                                                                                                                     +
  STABLE PARALLEL SAFE STRICT                                                                                                    +
 AS '$libdir/pg_trgm', $function$strict_word_similarity_commutator_op$function$                                                  +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_commutator_op(text, text)                                         +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_commutator_op$function$                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.strict_word_similarity_dist_op(text, text)                                                    +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$strict_word_similarity_dist_op$function$                                                        +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.strict_word_similarity_op(text, text)                                                         +
  RETURNS boolean                                                                                                                +
  LANGUAGE c                                                                                                                     +
  STABLE PARALLEL SAFE STRICT                                                                                                    +
 AS '$libdir/pg_trgm', $function$strict_word_similarity_op$function$                                                             +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.word_similarity(text, text)                                                                   +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$word_similarity$function$                                                                       +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.word_similarity_commutator_op(text, text)                                                     +
  RETURNS boolean                                                                                                                +
  LANGUAGE c                                                                                                                     +
  STABLE PARALLEL SAFE STRICT                                                                                                    +
 AS '$libdir/pg_trgm', $function$word_similarity_commutator_op$function$                                                         +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.word_similarity_dist_commutator_op(text, text)                                                +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$word_similarity_dist_commutator_op$function$                                                    +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.word_similarity_dist_op(text, text)                                                           +
  RETURNS real                                                                                                                   +
  LANGUAGE c                                                                                                                     +
  IMMUTABLE PARALLEL SAFE STRICT                                                                                                 +
 AS '$libdir/pg_trgm', $function$word_similarity_dist_op$function$                                                               +
 ;                                                                                                                               +
 
 CREATE OR REPLACE FUNCTION public.word_similarity_op(text, text)                                                                +
  RETURNS boolean                                                                                                                +
  LANGUAGE c                                                                                                                     +
  STABLE PARALLEL SAFE STRICT                                                                                                    +
 AS '$libdir/pg_trgm', $function$word_similarity_op$function$                                                                    +
 ;                                                                                                                               +
 
(71 rows)

