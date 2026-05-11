-- ============================================================
-- SEED — Test data for development (Costa Rica)
-- Users: admin@re.com / agent1@re.com … agent8@re.com
-- Password: test1234
-- ============================================================

-- Fixed UUIDs for predictable references
DO $$
DECLARE
  admin_id  UUID := '00000000-0000-0000-0000-000000000001';
  agent1_id UUID := '00000000-0000-0000-0000-000000000002';
  agent2_id UUID := '00000000-0000-0000-0000-000000000003';
  agent3_id UUID := '00000000-0000-0000-0000-000000000004';
  agent4_id UUID := '00000000-0000-0000-0000-000000000005';
  agent5_id UUID := '00000000-0000-0000-0000-000000000006';
  agent6_id UUID := '00000000-0000-0000-0000-000000000007';
  agent7_id UUID := '00000000-0000-0000-0000-000000000008';
  agent8_id UUID := '00000000-0000-0000-0000-000000000009';

  proj_template1_id UUID := '10000000-0000-0000-0000-000000000001';
  proj_template2_id UUID := '10000000-0000-0000-0000-000000000002';
  proj_fork1_id     UUID := '10000000-0000-0000-0000-000000000003';
  proj_fork2_id     UUID := '10000000-0000-0000-0000-000000000004';

  prop1_id  UUID := '20000000-0000-0000-0000-000000000001';
  prop2_id  UUID := '20000000-0000-0000-0000-000000000002';
  prop3_id  UUID := '20000000-0000-0000-0000-000000000003';
  prop4_id  UUID := '20000000-0000-0000-0000-000000000004';
  prop5_id  UUID := '20000000-0000-0000-0000-000000000005';
  prop6_id  UUID := '20000000-0000-0000-0000-000000000006';
  prop7_id  UUID := '20000000-0000-0000-0000-000000000007';
  prop8_id  UUID := '20000000-0000-0000-0000-000000000008';
  prop9_id  UUID := '20000000-0000-0000-0000-000000000009';
  prop10_id UUID := '20000000-0000-0000-0000-00000000000a';
  prop11_id UUID := '20000000-0000-0000-0000-00000000000b';

  share1_id UUID := '30000000-0000-0000-0000-000000000001';
  share2_id UUID := '30000000-0000-0000-0000-000000000002';
  share3_id UUID := '30000000-0000-0000-0000-000000000003';

  lead1_id  UUID := '40000000-0000-0000-0000-000000000001';
  lead2_id  UUID := '40000000-0000-0000-0000-000000000002';
  lead3_id  UUID := '40000000-0000-0000-0000-000000000003';
  lead4_id  UUID := '40000000-0000-0000-0000-000000000004';
  lead5_id  UUID := '40000000-0000-0000-0000-000000000005';
  lead6_id  UUID := '40000000-0000-0000-0000-000000000006';
  lead7_id  UUID := '40000000-0000-0000-0000-000000000007';
  lead8_id  UUID := '40000000-0000-0000-0000-000000000008';
  lead9_id  UUID := '40000000-0000-0000-0000-000000000009';

BEGIN

-- ── 1. AUTH USERS ──────────────────────────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-000000000000', admin_id,
    'authenticated', 'authenticated', 'admin@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Carlos Mendoza","role":"owner_admin","slug":"carlos-mendoza"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent1_id,
    'authenticated', 'authenticated', 'agent1@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Sofía Ramírez","role":"agent","slug":"sofia-ramirez"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent2_id,
    'authenticated', 'authenticated', 'agent2@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Diego Torres","role":"agent","slug":"diego-torres"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent3_id,
    'authenticated', 'authenticated', 'agent3@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Mariana Solano","role":"agent","slug":"mariana-solano"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent4_id,
    'authenticated', 'authenticated', 'agent4@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Andrés Vargas","role":"agent","slug":"andres-vargas"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent5_id,
    'authenticated', 'authenticated', 'agent5@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Valeria Jiménez","role":"agent","slug":"valeria-jimenez"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent6_id,
    'authenticated', 'authenticated', 'agent6@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Luis Castro","role":"agent","slug":"luis-castro"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent7_id,
    'authenticated', 'authenticated', 'agent7@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"Camila Rodríguez","role":"agent","slug":"camila-rodriguez"}'::jsonb,
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000', agent8_id,
    'authenticated', 'authenticated', 'agent8@re.com',
    crypt('test1234', gen_salt('bf')), now(),
    '{"full_name":"José Picado","role":"agent","slug":"jose-picado"}'::jsonb,
    now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- Trigger creates profiles; update extra fields including zones
UPDATE profiles SET
  role       = 'owner_admin',
  phone      = '+506 8888 0001',
  bio        = 'Director de la agencia. 15 años en el mercado costarricense, con foco en el GAM Oeste.',
  invited_by = NULL,
  zones      = ARRAY['gam_oeste']
WHERE id = admin_id;

UPDATE profiles SET
  phone      = '+506 8888 0002',
  bio        = 'Especialista en propiedades residenciales en Escazú, Santa Ana y Lindora. 8 años de experiencia en el GAM Oeste.',
  invited_by = admin_id,
  zones      = ARRAY['gam_oeste__escazu', 'gam_oeste__santa_ana', 'gam_oeste__lindora']
WHERE id = agent1_id;

UPDATE profiles SET
  phone      = '+506 8888 0003',
  bio        = 'Agente enfocado en Curridabat y Tres Ríos. Propiedades comerciales y residenciales entre el GAM Este y Cartago.',
  invited_by = admin_id,
  zones      = ARRAY['gam_este__curridabat', 'gam_este__tres_rios', 'cartago__tres_rios_este']
WHERE id = agent2_id;

UPDATE profiles SET
  phone      = '+506 8888 0004',
  bio        = 'Agente de bienes raíces en Tamarindo, Flamingo y Conchal. Enfoque en propiedades vacacionales y de inversión en la Costa Dorada de Guanacaste.',
  invited_by = admin_id,
  zones      = ARRAY['guanacaste_costa_dorada']
WHERE id = agent3_id;

UPDATE profiles SET
  phone      = '+506 8888 0005',
  bio        = 'Especialista en Jacó, Manuel Antonio y Quepos. Condominios frente al mar y casas de playa en el Pacífico Central.',
  invited_by = admin_id,
  zones      = ARRAY['pacifico_central_jaco', 'pacifico_central_quepos']
WHERE id = agent4_id;

UPDATE profiles SET
  phone      = '+506 8888 0006',
  bio        = 'Agente residencial en Heredia centro, San Pablo y Santo Domingo. Conocedora del GAM Norte y propiedades cerca del aeropuerto.',
  invited_by = admin_id,
  zones      = ARRAY['gam_norte__heredia_centro', 'gam_norte__san_pablo', 'gam_norte__santo_domingo']
WHERE id = agent5_id;

UPDATE profiles SET
  phone      = '+506 8888 0007',
  bio        = 'Agente del Pacífico Sur. Propiedades en Dominical, Uvita, Ojochal y la zona de Golfito.',
  invited_by = admin_id,
  zones      = ARRAY['pacifico_sur_dominical', 'pacifico_sur_zona_sur__golfito']
WHERE id = agent6_id;

UPDATE profiles SET
  phone      = '+506 8888 0008',
  bio        = 'Especialista en La Fortuna, Arenal y Ciudad Quesada. Casas de montaña, fincas y propiedades eco-turísticas en San Carlos.',
  invited_by = admin_id,
  zones      = ARRAY['zona_norte_san_carlos']
WHERE id = agent7_id;

UPDATE profiles SET
  phone      = '+506 8888 0009',
  bio        = 'Agente del Caribe Sur. Propiedades en Puerto Viejo y Cahuita. Casas de playa y lotes con título.',
  invited_by = admin_id,
  zones      = ARRAY['caribe_sur__puerto_viejo', 'caribe_sur__cahuita']
WHERE id = agent8_id;

-- ── 2. PROJECTS ────────────────────────────────────────────

-- Master templates (created by admin)
INSERT INTO projects (id, created_by, title, slug, description, developer_name, location_label,
  total_units, available_units, completion_date, status, is_master_template, is_active)
VALUES
  (
    proj_template1_id, admin_id,
    'Edificio Los Almendros', 'edificio-los-almendros',
    'Proyecto residencial de lujo en el corazón de Escazú con vista al Valle Central. Diseño contemporáneo, acabados de primera y amenidades completas.',
    'Constructora Horizonte CR', 'Trejos Montealegre, Escazú, San José',
    48, 12, '2026-06-30', 'under_construction', true, true
  ),
  (
    proj_template2_id, admin_id,
    'Condominio Vista Real Tamarindo', 'condominio-vista-real-tamarindo',
    'Condominio de villas frente al mar en Tamarindo, Guanacaste. Ideal para vivienda vacacional o renta corta. Acceso directo a la playa.',
    'Desarrolladora Pacífico Azul', 'Tamarindo, Santa Cruz, Guanacaste',
    24, 8, '2025-12-31', 'pre_launch', true, true
  )
ON CONFLICT (id) DO NOTHING;

-- Agent forks
INSERT INTO projects (id, created_by, title, slug, description, developer_name, location_label,
  total_units, available_units, completion_date, status, is_master_template, forked_from, is_active)
VALUES
  (
    proj_fork1_id, agent1_id,
    'Edificio Los Almendros', 'edificio-los-almendros-sofia-fork',
    'Proyecto residencial de lujo en el corazón de Escazú con vista al Valle Central. Diseño contemporáneo, acabados de primera y amenidades completas.',
    'Constructora Horizonte CR', 'Trejos Montealegre, Escazú, San José',
    48, 12, '2026-06-30', 'under_construction', false, proj_template1_id, true
  ),
  (
    proj_fork2_id, agent3_id,
    'Condominio Vista Real Tamarindo', 'condominio-vista-real-tamarindo-mariana-fork',
    'Condominio de villas frente al mar en Tamarindo, Guanacaste. Acceso directo a la playa.',
    'Desarrolladora Pacífico Azul', 'Tamarindo, Santa Cruz, Guanacaste',
    24, 8, '2025-12-31', 'pre_launch', false, proj_template2_id, true
  )
ON CONFLICT (id) DO NOTHING;

-- Project amenities
INSERT INTO project_amenities (project_id, name, icon, sort_order) VALUES
  (proj_template1_id, 'Piscina', 'pool', 1),
  (proj_template1_id, 'Gimnasio', 'dumbbell', 2),
  (proj_template1_id, 'Área de coworking', 'laptop', 3),
  (proj_template1_id, 'Parqueo techado', 'car', 4),
  (proj_template2_id, 'Piscina infinity', 'pool', 1),
  (proj_template2_id, 'Acceso a playa', 'waves', 2),
  (proj_template2_id, 'Rancho BBQ', 'flame', 3);

-- Project photos (using Unsplash for placeholders)
INSERT INTO project_photos (project_id, url, type, is_cover, order_index, caption) VALUES
  (proj_template1_id, 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800', 'hero',    true,  0, 'Fachada principal Escazú'),
  (proj_template1_id, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800', 'gallery', false, 1, 'Apartamento tipo A'),
  (proj_template1_id, 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800', 'amenity', false, 2, 'Piscina'),
  (proj_template2_id, 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800', 'hero',    true,  0, 'Vista al mar Tamarindo'),
  (proj_template2_id, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', 'gallery', false, 1, 'Villa frente a la playa');

-- ── 3. PROPERTIES ──────────────────────────────────────────

INSERT INTO properties (
  id, created_by, project_id, title, slug, description,
  price, currency, property_type, status,
  bedrooms, bathrooms, area_sqm, floor, parking_spaces,
  location_mode, public_address, exact_address, display_address,
  display_lat, display_lng, is_featured, anonymous_slug
) VALUES
  -- Agent 1 (gam_oeste / gam_centro)
  (
    prop1_id, agent1_id, proj_fork1_id,
    'Apartamento 3H en Escazú - Piso 8',
    'apto-3h-escazu-piso8',
    'Espectacular apartamento de 3 habitaciones con vista al Valle Central. Acabados de lujo, cocina italiana, clósets empotrados. Edificio con amenidades completas en Trejos Montealegre.',
    485000, 'USD', 'apartment', 'available',
    3, 2, 138.5, 8, 2,
    'approximate', 'Trejos Montealegre, Escazú, San José', 'Trejos Montealegre 200m sur del Hospital CIMA, Escazú', 'Escazú, San José',
    9.9356, -84.1378, true,
    'anon-prop1-xxxxxxxx'
  ),
  (
    prop2_id, agent1_id, proj_fork1_id,
    'Studio Premium Sabana - Piso 12',
    'studio-premium-sabana-piso12',
    'Studio moderno con terraza privada y vista al Parque La Sabana. Perfecto para inversión como Airbnb o primera vivienda en el centro de San José.',
    195000, 'USD', 'apartment', 'available',
    1, 1, 58.0, 12, 1,
    'approximate', 'Sabana Norte, San José', 'Torre Eiffel, Sabana Norte 300m oeste del ICE, San José', 'Sabana, San José',
    9.9381, -84.1010, false,
    'anon-prop2-xxxxxxxx'
  ),
  (
    prop3_id, agent1_id, NULL,
    'Casa en Santa Ana - Condominio',
    'casa-santa-ana-condominio',
    'Espléndida casa independiente en condominio cerrado de Santa Ana. Jardín, terraza, piscina compartida y cuarto de empleada. Vigilancia 24/7.',
    620000, 'USD', 'house', 'available',
    4, 4, 320.0, NULL, 2,
    'exact', 'Pozos, Santa Ana, San José', 'Condominio Hacienda del Sol, Pozos de Santa Ana, lote 14', 'Santa Ana, San José',
    9.9356, -84.1859, true,
    NULL
  ),
  -- Agent 2 (gam_este / cartago)
  (
    prop4_id, agent2_id, NULL,
    'Apartamento en Curridabat - Pinares',
    'apto-curridabat-pinares',
    'Apartamento de 2 habitaciones en torre moderna de Pinares. Excelente ubicación, cerca del Mall San Pedro y la UCR. Listo para entregar.',
    245000, 'USD', 'apartment', 'available',
    2, 2, 92.0, 6, 1,
    'approximate', 'Pinares, Curridabat, San José', 'Torre Pinares Plaza, 100m este del Pricesmart, Curridabat', 'Curridabat, San José',
    9.9091, -84.0309, false,
    'anon-prop4-xxxxxxxx'
  ),
  (
    prop5_id, agent2_id, NULL,
    'Casa en Tres Ríos - La Unión',
    'casa-tres-rios-la-union',
    'Casa familiar en residencial cerrado de Tres Ríos, con vista al volcán Irazú. Tres habitaciones, estudio y amplio jardín.',
    310000, 'USD', 'house', 'available',
    3, 3, 240.0, NULL, 2,
    'exact', 'San Diego, La Unión, Cartago', 'Residencial Cipreses del Sol, San Diego de La Unión, casa 22', 'Tres Ríos, Cartago',
    9.9050, -83.9947, false,
    NULL
  ),
  (
    prop6_id, agent2_id, NULL,
    'Lote 800m² - Paraíso, Cartago',
    'lote-800m2-paraiso-cartago',
    'Lote plano con todos los servicios en zona consolidada de Paraíso. Ideal para construir vivienda familiar. Vista al Valle de Orosi.',
    115000, 'USD', 'land', 'available',
    NULL, NULL, 800.0, NULL, NULL,
    'approximate', 'Paraíso, Cartago', '500m sur de la iglesia de Paraíso, Cartago', 'Paraíso, Cartago',
    9.8377, -83.8636, false,
    NULL
  ),
  -- Agent 3 (guanacaste_norte)
  (
    prop7_id, agent3_id, proj_fork2_id,
    'Villa frente al mar - Tamarindo',
    'villa-frente-al-mar-tamarindo',
    'Villa de lujo a 50 metros de Playa Tamarindo. 4 habitaciones, piscina privada, terraza con vista al océano. Excelente como inversión vacacional.',
    895000, 'USD', 'house', 'available',
    4, 4, 280.0, NULL, 2,
    'approximate', 'Tamarindo, Santa Cruz, Guanacaste', 'Condominio Vista Real, Playa Tamarindo, villa 7', 'Tamarindo, Guanacaste',
    10.2992, -85.8404, true,
    'anon-prop7-xxxxxxxx'
  ),
  (
    prop8_id, agent3_id, NULL,
    'Condo en Playas del Coco - 2H',
    'condo-playas-del-coco-2h',
    'Condominio de 2 habitaciones a 5 minutos de Playas del Coco. Piscina, gimnasio y rancho. Listo para alquiler corto plazo.',
    285000, 'USD', 'apartment', 'available',
    2, 2, 95.0, 3, 1,
    'approximate', 'Playas del Coco, Carrillo, Guanacaste', 'Condominio Pacífico, 800m del centro de Coco', 'Playas del Coco, Guanacaste',
    10.5485, -85.6952, false,
    'anon-prop8-xxxxxxxx'
  ),
  -- Agent 4 (pacifico_central)
  (
    prop9_id, agent4_id, NULL,
    'Condo frente al mar - Jacó',
    'condo-frente-al-mar-jaco',
    'Condominio de 3 habitaciones en Playa Hermosa, Jacó. Vista directa al mar, piscina infinity y acceso privado a la playa.',
    395000, 'USD', 'apartment', 'available',
    3, 2, 145.0, 5, 1,
    'approximate', 'Playa Hermosa, Garabito, Puntarenas', 'Torre Bahía Azul, Playa Hermosa de Jacó, piso 5', 'Jacó, Puntarenas',
    9.5836, -84.6431, true,
    'anon-prop9-xxxxxxxx'
  ),
  -- Agent 6 (zona_sur / guanacaste_sur)
  (
    prop10_id, agent6_id, NULL,
    'Casa de playa - Dominical',
    'casa-playa-dominical',
    'Casa de 3 habitaciones a 200m de Playa Dominicalito. Diseño tropical, piscina y jardín nativo. Excelente clima y surf de clase mundial.',
    520000, 'USD', 'house', 'available',
    3, 3, 210.0, NULL, 2,
    'exact', 'Playa Dominicalito, Aguirre, Puntarenas', 'Calle a Dominicalito 400m sur de la entrada principal, Dominical', 'Dominical, Puntarenas',
    9.2347, -83.8584, false,
    NULL
  ),
  -- Agent 7 (zona_norte)
  (
    prop11_id, agent7_id, NULL,
    'Casa de montaña - La Fortuna',
    'casa-montana-la-fortuna',
    'Casa de campo con vista al Volcán Arenal. 3 habitaciones, jardín amplio y aguas termales naturales en la propiedad. Ideal para vivienda o eco-lodge.',
    410000, 'USD', 'house', 'available',
    3, 2, 195.0, NULL, 3,
    'exact', 'La Fortuna, San Carlos, Alajuela', 'Camino a Tabacón 1.2km norte, La Fortuna de San Carlos', 'La Fortuna, Alajuela',
    10.4707, -84.6452, false,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Property photos
INSERT INTO property_photos (property_id, url, is_cover, order_index, caption) VALUES
  -- prop1
  (prop1_id, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', true,  0, 'Sala principal'),
  (prop1_id, 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800', false, 1, 'Cocina'),
  (prop1_id, 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800', false, 2, 'Habitación principal'),
  (prop1_id, 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?w=800', false, 3, 'Vista al Valle Central'),
  -- prop2
  (prop2_id, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', true,  0, 'Sala/comedor'),
  (prop2_id, 'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800', false, 1, 'Terraza Sabana'),
  -- prop3
  (prop3_id, 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', true,  0, 'Fachada Santa Ana'),
  (prop3_id, 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=800', false, 1, 'Piscina'),
  (prop3_id, 'https://images.unsplash.com/photo-1617806118233-18e1de247200?w=800', false, 2, 'Jardín'),
  -- prop4
  (prop4_id, 'https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800', true,  0, 'Sala Curridabat'),
  -- prop5
  (prop5_id, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', true,  0, 'Casa Tres Ríos'),
  -- prop6
  (prop6_id, 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800', true,  0, 'Vista del lote'),
  -- prop7
  (prop7_id, 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', true,  0, 'Villa frente al mar'),
  (prop7_id, 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800', false, 1, 'Piscina privada'),
  -- prop8
  (prop8_id, 'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800', true,  0, 'Condo Coco'),
  -- prop9
  (prop9_id, 'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800', true,  0, 'Vista al mar Jacó'),
  -- prop10
  (prop10_id, 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=800', true,  0, 'Casa Dominical'),
  -- prop11
  (prop11_id, 'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800', true,  0, 'Vista al Arenal');

-- ── 4. PROPERTY SHARES ─────────────────────────────────────

-- Agent1 shares prop1 with admin → goes to marketplace (approved)
INSERT INTO property_shares (id, property_id, shared_by, shared_with, public_contact_user_id,
  status, commission_type, commission_value, notes)
VALUES
  (
    share1_id, prop1_id, agent1_id, admin_id, admin_id,
    'approved', 'percentage', 3.0,
    'Apartamento destacado para marketplace. Precio negociable.'
  ),
  -- Agent3 shares prop7 with admin → pending review
  (
    share2_id, prop7_id, agent3_id, admin_id, admin_id,
    'pending', 'percentage', 3.5,
    'Villa de lujo en Tamarindo, lista para publicar en marketplace.'
  ),
  -- Agent1 shares prop2 with agent2 → approved collaboration
  (
    share3_id, prop2_id, agent1_id, agent2_id, agent2_id,
    'approved', 'fixed', 2500.0,
    'Colaboración — Diego tiene cliente interesado en studios cerca de la Sabana.'
  )
ON CONFLICT DO NOTHING;

-- Refresh marketplace visibility for prop1 (has approved admin share)
UPDATE properties SET is_marketplace_visible = true WHERE id = prop1_id;

-- ── 5. INVITATIONS ─────────────────────────────────────────

INSERT INTO invitations (email, invited_by, role, status, expires_at, accepted_at, accepted_by)
VALUES
  ('agent1@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '40 days', agent1_id),
  ('agent2@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '35 days', agent2_id),
  ('agent3@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '30 days', agent3_id),
  ('agent4@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '25 days', agent4_id),
  ('agent5@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '20 days', agent5_id),
  ('agent6@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '15 days', agent6_id),
  ('agent7@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '10 days', agent7_id),
  ('agent8@re.com', admin_id, 'agent', 'accepted', now() + interval '7 days', now() - interval '5 days',  agent8_id),
  ('pendiente@re.com', admin_id, 'agent', 'pending', now() + interval '7 days', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ── 6. LEADS ───────────────────────────────────────────────

-- Disable trigger temporarily to insert leads without auto-history duplication
ALTER TABLE leads DISABLE TRIGGER trg_lead_stage_history;

INSERT INTO leads (id, property_id, full_name, email, phone, source, stage,
  assigned_to, captured_by, notes, source_context)
VALUES
  (
    lead1_id, prop1_id,
    'María Fernández', 'maria.fernandez@gmail.com', '+506 8712 4455',
    'marketplace', 'interested',
    agent1_id, agent1_id,
    'Muy interesada, tiene pre-aprobación bancaria de hasta $500k. Quiere visitar el apartamento de Escazú el fin de semana.',
    'marketplace-listing'
  ),
  (
    lead2_id, prop1_id,
    'Roberto Gálvez', 'roberto.galvez@hotmail.com', '+506 8633 1199',
    'agent_profile', 'visit_scheduled',
    agent1_id, agent1_id,
    'Visita agendada para el sábado 10am. Viene con su esposa. Le interesan los pisos altos con vista.',
    'sofia-ramirez-profile'
  ),
  (
    lead3_id, prop3_id,
    'Holding Centroamericano S.A.', 'contacto@holdingca.cr', '+506 2289 4321',
    'direct', 'negotiating',
    agent1_id, agent1_id,
    'Empresa buscando casa para directivos en Santa Ana. Propuesta inicial recibida a $585k. Esperando contraoferta.',
    NULL
  ),
  (
    lead4_id, prop4_id,
    'Ana Lucía Brenes', 'abrenes@bufete.cr', '+506 8456 7788',
    'agent_profile', 'new',
    agent2_id, agent2_id,
    'Bufete de abogados buscando apartamento en Curridabat. Necesitan mínimo 90m². Presupuesto hasta $260k.',
    'diego-torres-profile'
  ),
  (
    lead5_id, prop2_id,
    'Javier Mendoza', 'jmendoza@gmail.com', '+506 8901 2233',
    'anonymous_link', 'contacted',
    agent2_id, agent1_id,
    'Llegó por link anónimo. Inversor que busca studio cerca de la Sabana para Airbnb. Ya contactado por Diego.',
    'anon-prop2-xxxxxxxx'
  ),
  (
    lead6_id, prop7_id,
    'Juan Carlos Mora', 'jcmora@outlook.com', '+506 8567 3344',
    'marketplace', 'interested',
    agent3_id, agent3_id,
    'Cliente expat canadiense busca villa en Tamarindo para uso vacacional + renta. Visita programada para diciembre.',
    'marketplace-listing'
  ),
  (
    lead7_id, prop9_id,
    'Sandra Quirós', 'sandra.quiros@gmail.com', '+506 8234 5566',
    'agent_profile', 'contacted',
    agent4_id, agent4_id,
    'Pareja interesada en condominio en Jacó. Buscan segunda vivienda para fines de semana desde San José.',
    'andres-vargas-profile'
  ),
  (
    lead8_id, prop10_id,
    'Michael Thompson', 'mthompson.cr@gmail.com', '+506 8678 9911',
    'marketplace', 'visit_scheduled',
    agent6_id, agent6_id,
    'Expat estadounidense reubicándose a Dominical. Visita agendada el próximo viernes. Pago en efectivo.',
    'marketplace-listing'
  ),
  (
    lead9_id, prop11_id,
    'Laura Picado', 'lpicado@gmail.com', '+506 8345 6677',
    'direct', 'new',
    agent7_id, agent7_id,
    'Familia tica buscando casa de montaña en La Fortuna como segunda vivienda. Presupuesto flexible.',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

ALTER TABLE leads ENABLE TRIGGER trg_lead_stage_history;

-- Insert lead history manually
INSERT INTO lead_status_history (lead_id, changed_by, from_stage, to_stage, notes) VALUES
  (lead1_id, agent1_id, NULL,          'new',            'Lead capturado desde marketplace'),
  (lead1_id, agent1_id, 'new',         'contacted',      'Llamada inicial exitosa'),
  (lead1_id, agent1_id, 'contacted',   'interested',     'Envió documentos financieros'),
  (lead2_id, agent1_id, NULL,          'new',            'Lead desde perfil agente'),
  (lead2_id, agent1_id, 'new',         'contacted',      'WhatsApp respondido'),
  (lead2_id, agent1_id, 'contacted',   'interested',     'Confirma interés fuerte'),
  (lead2_id, agent1_id, 'interested',  'visit_scheduled','Visita sábado 10am confirmada'),
  (lead3_id, agent1_id, NULL,          'new',            'Consulta directa empresa'),
  (lead3_id, agent1_id, 'new',         'contacted',      'Reunión con representante'),
  (lead3_id, agent1_id, 'contacted',   'interested',     'Visita realizada, muy interesados'),
  (lead3_id, agent1_id, 'interested',  'negotiating',    'Propuesta enviada $585k'),
  (lead4_id, agent2_id, NULL,          'new',            'Lead desde perfil Diego'),
  (lead5_id, agent1_id, NULL,          'new',            'Lead por link anónimo'),
  (lead5_id, agent2_id, 'new',         'contacted',      'Diego tomó el lead y contactó'),
  (lead6_id, agent3_id, NULL,          'new',            'Lead marketplace Tamarindo'),
  (lead6_id, agent3_id, 'new',         'contacted',      'WhatsApp inicial respondido'),
  (lead6_id, agent3_id, 'contacted',   'interested',     'Solicita más fotos y video'),
  (lead7_id, agent4_id, NULL,          'new',            'Lead Jacó desde perfil agente'),
  (lead7_id, agent4_id, 'new',         'contacted',      'Llamada de calificación realizada'),
  (lead8_id, agent6_id, NULL,          'new',            'Lead Dominical desde marketplace'),
  (lead8_id, agent6_id, 'new',         'contacted',      'Email inicial enviado'),
  (lead8_id, agent6_id, 'contacted',   'interested',     'Confirma intención de compra'),
  (lead8_id, agent6_id, 'interested',  'visit_scheduled','Visita confirmada viernes'),
  (lead9_id, agent7_id, NULL,          'new',            'Consulta directa La Fortuna')
ON CONFLICT DO NOTHING;

-- ── 7. CONTRACT TEMPLATES ──────────────────────────────────

INSERT INTO contract_templates (created_by, name, description, body_html, variables, is_active)
VALUES
  (
    admin_id,
    'Contrato de Reserva Estándar',
    'Contrato de reserva para compra de inmueble con depósito de garantía (Costa Rica).',
    '<h1>CONTRATO DE RESERVA</h1><p>Entre <strong>{{vendor_name}}</strong> como vendedor y <strong>{{buyer_name}}</strong> como comprador...</p><p>Inmueble: {{property_address}}</p><p>Precio acordado: {{price}} {{currency}}</p><p>Monto de reserva: {{deposit_amount}}</p>',
    '[{"key":"vendor_name","label":"Nombre vendedor"},{"key":"buyer_name","label":"Nombre comprador"},{"key":"property_address","label":"Dirección inmueble"},{"key":"price","label":"Precio"},{"key":"currency","label":"Moneda"},{"key":"deposit_amount","label":"Depósito"}]'::jsonb,
    true
  ),
  (
    admin_id,
    'Opción de Compraventa',
    'Opción de compraventa preliminar para transferencia de propiedad ante notario público.',
    '<h1>OPCIÓN DE COMPRAVENTA</h1><p>Fecha: {{date}}</p><p>Vendedor: {{vendor_name}}, cédula {{vendor_id}}</p><p>Comprador: {{buyer_name}}, cédula {{buyer_id}}</p><p>Inmueble inscrito en el Registro Nacional, ubicado en {{property_address}}, con área de {{area_sqm}} m².</p>',
    '[{"key":"date","label":"Fecha"},{"key":"vendor_name","label":"Vendedor"},{"key":"vendor_id","label":"Cédula Vendedor"},{"key":"buyer_name","label":"Comprador"},{"key":"buyer_id","label":"Cédula Comprador"},{"key":"property_address","label":"Dirección"},{"key":"area_sqm","label":"Área m²"}]'::jsonb,
    true
  )
ON CONFLICT DO NOTHING;

-- ── 8. CONTRACTS ───────────────────────────────────────────

INSERT INTO contracts (lead_id, created_by, status, variables_data)
SELECT
  lead3_id,
  agent1_id,
  'sent',
  '{"vendor_name":"RE Inmobiliaria CR","buyer_name":"Holding Centroamericano S.A.","property_address":"Pozos de Santa Ana, condominio Hacienda del Sol","price":"585000","currency":"USD","deposit_amount":"30000"}'::jsonb
ON CONFLICT DO NOTHING;

-- ── 9. CONVERSATIONS ───────────────────────────────────────

WITH conv AS (
  INSERT INTO conversations (lead_id, channel, status, assigned_to, last_message_at)
  VALUES (lead1_id, 'whatsapp', 'open', agent1_id, now() - interval '2 hours')
  RETURNING id
)
INSERT INTO conversation_messages (conversation_id, direction, content)
SELECT
  id,
  direction,
  content
FROM conv CROSS JOIN (VALUES
  ('outbound'::message_direction, 'Hola María, soy Sofía de RE Inmobiliaria. Vi tu consulta sobre el apartamento en Escazú. ¿Cuándo podría llamarte?'),
  ('inbound'::message_direction,  '¡Hola Sofía! Me alegra que respondas. Puedes llamarme hoy después de las 6pm.'),
  ('outbound'::message_direction, 'Perfecto, te llamo a las 6:30pm. ¡Tenemos muy buenas noticias sobre el precio!'),
  ('inbound'::message_direction,  'Excelente, estaré esperando tu llamada.')
) AS msgs(direction, content);

END $$;
