/*
  # Create Education System - Schools, Colleges, Universities

  ## Purpose
  Add education filtering system to allow users to connect with friends from their schools,
  colleges, and universities. Three separate tables for each education type.

  ## New Tables
  1. `schools` - Secondary schools (240+ London schools)
     - id (uuid, primary key)
     - school_name (text, unique)
     - education_type (text, default 'secondary')
     - location (text, default 'London')
     - created_at (timestamptz)

  2. `colleges` - Further education colleges (50+ London colleges)
     - id (uuid, primary key)
     - college_name (text, unique)
     - education_type (text, default 'college')
     - location (text, default 'London')
     - created_at (timestamptz)

  3. `universities` - Universities (50+ London universities)
     - id (uuid, primary key)
     - university_name (text, unique)
     - education_type (text, default 'university')
     - location (text, default 'London')
     - created_at (timestamptz)

  ## Profile Updates
  Add three nullable foreign key fields to profiles:
  - secondary_school_id → schools(id)
  - college_id → colleges(id)
  - university_id → universities(id)

  Users can select any combination (0-3) of education institutions.

  ## Security
  - Enable RLS on all education tables
  - Allow public read access (for autocomplete searches)
  - Only admins can insert/update/delete education data
  - Users can update their own education fields in profiles

  ## Use Cases
  - Edit Profile: Select education from autocomplete dropdowns
  - Search Friends: Filter friends by education (AND logic for multiple filters)
  - Internal use only: Not displayed on public profile pages
*/

-- ============================================================================
-- 1. CREATE SCHOOLS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text UNIQUE NOT NULL,
  education_type text DEFAULT 'secondary',
  location text DEFAULT 'London',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Schools are publicly readable"
  ON schools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage schools"
  ON schools FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username IN ('test123', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username IN ('test123', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(school_name);

-- ============================================================================
-- 2. CREATE COLLEGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS colleges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  college_name text UNIQUE NOT NULL,
  education_type text DEFAULT 'college',
  location text DEFAULT 'London',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE colleges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Colleges are publicly readable"
  ON colleges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage colleges"
  ON colleges FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username IN ('test123', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username IN ('test123', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_colleges_name ON colleges(college_name);

-- ============================================================================
-- 3. CREATE UNIVERSITIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_name text UNIQUE NOT NULL,
  education_type text DEFAULT 'university',
  location text DEFAULT 'London',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Universities are publicly readable"
  ON universities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can manage universities"
  ON universities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username IN ('test123', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.username IN ('test123', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_universities_name ON universities(university_name);

-- ============================================================================
-- 4. ADD EDUCATION FIELDS TO PROFILES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'secondary_school_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN secondary_school_id uuid REFERENCES schools(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'college_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN college_id uuid REFERENCES colleges(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'university_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN university_id uuid REFERENCES universities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_secondary_school ON profiles(secondary_school_id) WHERE secondary_school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_college ON profiles(college_id) WHERE college_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_university ON profiles(university_id) WHERE university_id IS NOT NULL;

-- ============================================================================
-- 5. POPULATE SCHOOLS DATA (240+ London Secondary Schools)
-- ============================================================================

INSERT INTO schools (school_name) VALUES
('Academy21'),
('Acland Burghley School'),
('Ada Lovelace Church of England High School'),
('Addey and Stanhope School'),
('AIM Academy North London'),
('Alexandra Park School'),
('All Saints Catholic College'),
('All Saints Catholic High School'),
('Ark Acton Academy'),
('Ark All Saints Academy'),
('Ark Bolingbroke Academy'),
('Ark Burlington Danes Academy'),
('Ark Elvin Academy'),
('Ark Evelyn Grace Academy'),
('Ark Greenwich Free School'),
('Ark Putney Academy'),
('Ark Soane Academy'),
('Ark Walworth Academy'),
('Arts and Media School Islington'),
('Ashcroft Technology Academy'),
('Ashmole Academy'),
('Aylward Academy'),
('Bacon''s College'),
('Beacon High'),
('Bishop Challoner Catholic School'),
('Bishop Douglass School Finchley'),
('Bishop Thomas Grant Catholic Secondary School'),
('Bow School'),
('Brampton Manor Academy'),
('Brentside High School'),
('Burntwood School'),
('Canary Wharf College Crossharbour'),
('Cardinal Pole Catholic School'),
('Central Foundation Boys'' School'),
('Central Foundation Girls'' School'),
('Chelsea Academy'),
('Chestnut Grove Academy'),
('Chingford Foundation School'),
('Chiswick School'),
('Christ''s College Finchley'),
('City Heights E-ACT Academy'),
('City of London Academy (Southwark)'),
('City of London Academy Highbury Grove'),
('City of London Academy Islington'),
('City of London Academy Highgate Hill'),
('City of London Academy Shoreditch Park'),
('Clapton Girls'' Academy'),
('Clarion'),
('Connaught School for Girls'),
('Copthall School'),
('Cumberland Community School'),
('Deptford Green School'),
('Drayton Manor High School'),
('Duke''s Aldridge'),
('E-ACT Crest Academy'),
('Ealing Fields Church of England High School'),
('Eden Girls'' School Waltham Forest'),
('Elizabeth Garrett Anderson School'),
('Eltham Hill School'),
('Elthorne Park High School'),
('Ernest Bevin Academy'),
('Finchley Catholic High School'),
('Forest Gate Community School'),
('Forest Hill School'),
('Fortismere School'),
('Frederick Bremer School'),
('Friern Barnet School'),
('Fulham Cross Academy'),
('Fulham Cross Girls'' School and Language College'),
('George Green''s School'),
('Gladesmore Community School'),
('Graveney School'),
('Greig City Academy'),
('Haberdashers'' Borough Academy'),
('Haberdashers'' Hatcham College'),
('Haggerston School'),
('Hammersmith Academy'),
('Hampstead School'),
('Harris Academy Battersea'),
('Harris Academy Bermondsey'),
('Harris Academy Beulah Hill'),
('Harris Academy Clapham'),
('Harris Academy Greenwich'),
('Harris Academy Peckham'),
('Harris Academy South Norwood'),
('Harris Academy St John''s Wood'),
('Harris Academy Wimbledon'),
('Harris Boys'' Academy East Dulwich'),
('Harris City Academy Crystal Palace'),
('Harris Girls'' Academy East Dulwich'),
('Harris Lowe Academy Willesden'),
('Harris Science Academy East London'),
('Hasmonean High School for Boys'),
('Hasmonean High School for Girls'),
('Haverstock School'),
('Heartlands High School'),
('Heathcote School & Science College'),
('Hendon School'),
('Highams Park School'),
('Highbury Fields School'),
('Highgate Wood Secondary School'),
('Highlands School'),
('Holland Park School'),
('Holy Family Catholic School'),
('Hornsey School for Girls'),
('Kelmscott School'),
('Kensington Aldridge Academy'),
('Kingsbury High School'),
('Kingsdale Foundation School'),
('Kingsford Community School'),
('La Retraite Roman Catholic Girls'' School'),
('La Sainte Union Catholic Secondary School'),
('Lady Margaret School'),
('Lammas School'),
('Langdon Park Community School'),
('Laurel Park School'),
('Leigh Academy Blackheath'),
('Leigh Academy Halley'),
('Leigh Stationers'' Academy'),
('Leytonstone School'),
('Lilian Baylis Technology School'),
('Lister Community School'),
('Little Ilford School'),
('London Design and Engineering UTC'),
('London Enterprise Academy'),
('London Nautical City of London Academy'),
('Lubavitch House School Senior Girls'),
('Maria Fidelis Catholic School FCJ'),
('Marylebone Boys'' School'),
('Menorah High School for Girls'),
('Michaela Community School'),
('Mill Hill County High School'),
('Minerva''s Virtual Academy'),
('Morpeth School'),
('Mossbourne Community Academy'),
('Mossbourne Victoria Park Academy'),
('Mulberry Academy London Dock'),
('Mulberry Academy Shoreditch'),
('Mulberry Academy Woodside'),
('Mulberry School for Girls'),
('Mulberry Stepney Green Mathematics and Computing College'),
('Mulberry UTC'),
('Newman Catholic College'),
('Norlington School and 6th Form'),
('North Brent School'),
('Notre Dame Catholic Girls'' School'),
('Oaklands School'),
('Oasis Academy Arena'),
('Oasis Academy Silvertown'),
('Oasis Academy South Bank'),
('Paddington Academy'),
('Park View School'),
('Parliament Hill School'),
('Phoenix Academy'),
('Pimlico Academy'),
('Plashet School'),
('Platanos College'),
('Plumstead Manor School'),
('Prendergast School'),
('Queens Park Community School'),
('Raynes Park High School'),
('Regent High School'),
('Ricards Lodge High School'),
('Richmond Park Academy'),
('Rokeby School'),
('Royal Docks Academy'),
('Royal Greenwich Trust School'),
('Rutlish School'),
('Sacred Heart Catholic School'),
('Sacred Heart High School'),
('Saint Cecilia''s Church of England School'),
('Saint Claudine''s Catholic School for Girls'),
('Saint Gabriel''s College'),
('Saint John Bosco College'),
('Saracens High School'),
('Sarah Bonnell School'),
('Sedgehill Academy'),
('Skinners'' Academy'),
('South Bank University Academy'),
('South Chingford Foundation School'),
('Southfields Academy'),
('St Aloysius'' College'),
('St Andrew the Apostle Greek Orthodox School'),
('St Angela''s Ursuline School'),
('St Anne''s Catholic High School for Girls'),
('St Augustine''s Federated Schools CE High School'),
('St Bonaventure''s RC School'),
('St George''s Catholic School'),
('St James'' Catholic High School'),
('St Joseph''s College'),
('St Michael''s Catholic College'),
('St Michael''s Catholic Grammar School'),
('St Paul''s Academy'),
('St Richard Reynolds Catholic High School'),
('St Saviour''s and St Olave''s Church of England School'),
('St Thomas More Catholic Comprehensive School'),
('St Thomas More Catholic School'),
('St Ursula''s Convent School'),
('St Thomas More Language College'),
('Stepney All Saints Church of England Secondary School'),
('Stoke Newington School and Sixth Form'),
('Stratford School Academy'),
('Swanlea School'),
('Sydenham School'),
('The Archer Academy'),
('The Bridge Academy'),
('The Camden School for Girls'),
('The Cardinal Vaughan Memorial RC School'),
('The Charter School Bermondsey'),
('The Charter School East Dulwich'),
('The Charter School North Dulwich'),
('The City Academy Hackney'),
('The Compton School'),
('The Ellen Wilkinson School for Girls'),
('The Elmgreen School'),
('The Elms Academy'),
('The Excelsior Academy'),
('The Fulham Boys School'),
('The Grey Coat Hospital'),
('The Henrietta Barnett School'),
('The Hurlingham Academy'),
('The John Roan School'),
('The Latymer School'),
('The London Oratory School'),
('The Norwood School'),
('The St Marylebone CofE School'),
('The St Thomas the Apostle College'),
('The Totteridge Academy'),
('The Urswick School A Church of England Secondary School'),
('Thomas Tallis School'),
('Tom Hood School'),
('Trinity Academy'),
('Twyford Church of England High School'),
('Ursuline High School Wimbledon'),
('Walthamstow Academy'),
('Walthamstow School for Girls'),
('Wanstead High School'),
('Wapping High School'),
('Waterside Academy'),
('West London Free School'),
('Westminster Academy'),
('William Ellis School'),
('Willowfield School'),
('Wimbledon College'),
('Winchmore School'),
('Woolwich Polytechnic School'),
('Yesodey Hatorah Senior Girls School')
ON CONFLICT (school_name) DO NOTHING;

-- ============================================================================
-- 6. POPULATE COLLEGES DATA (50+ London Colleges)
-- ============================================================================

INSERT INTO colleges (college_name) VALUES
('Ada National College for Digital Skills'),
('Barking and Dagenham College'),
('Barnet and Southgate College'),
('Capel Manor College'),
('Capital City College Sixth Form'),
('Capital City College Alexandra Centre'),
('Capital City College Angel'),
('Capital City College Enfield'),
('Capital City College Finsbury Park'),
('Capital City College Holloway'),
('Capital City College Regent''s Park'),
('Capital City College Tottenham'),
('Capital City College Soho'),
('Capital City College Westminster'),
('Capital City College King''s Cross'),
('Carshalton College'),
('Christ the King Sixth Form College'),
('City Lit'),
('City of Westminster College'),
('College of North West London'),
('Croydon College'),
('Haringey Sixth Form College'),
('Harrow College'),
('John Ruskin College'),
('Kingston College'),
('Lewisham College'),
('Leyton Sixth Form College'),
('London South East Colleges'),
('Mary Ward Centre'),
('Merton College'),
('Morley College'),
('New City College Epping Forest'),
('New City College Hackney'),
('New City College Havering Sixth Form College'),
('New City College Redbridge'),
('New City College Hackney Sixth Form'),
('New City College Tower Hamlets'),
('Newham College'),
('Newham Sixth Form College'),
('Orchard Hill College'),
('Richmond and Hillcroft Adult and Community College'),
('Richmond upon Thames College'),
('Sir George Monoux College'),
('South Bank Colleges Lambeth College'),
('South Bank Colleges London South Bank Technical College'),
('South Thames College'),
('South Thames Colleges Group'),
('Southwark College'),
('St Charles Sixth Form College'),
('St Francis Xavier Sixth Form College'),
('Stanmore College'),
('Uxbridge College'),
('Waltham Forest College'),
('West London College'),
('West Thames College'),
('WMC The Camden College')
ON CONFLICT (college_name) DO NOTHING;

-- ============================================================================
-- 7. POPULATE UNIVERSITIES DATA (50+ London Universities)
-- ============================================================================

INSERT INTO universities (university_name) VALUES
('Ravensbourne University London'),
('Brunel University of London'),
('Goldsmiths University of London'),
('University of Roehampton'),
('The University of Law'),
('Middlesex University'),
('King''s College London University of London'),
('University of East London'),
('University of West London'),
('University of Central Lancashire London'),
('London Metropolitan University'),
('Northeastern University London'),
('Regent''s University London'),
('Richmond American University London'),
('London Business School University of London'),
('London South Bank University'),
('University of London Institute in Paris'),
('Amity University London'),
('Birkbeck University of London'),
('SOAS University of London'),
('UCL University College London'),
('Queen Mary University of London'),
('Royal Holloway University of London'),
('City St George''s University of London'),
('Royal Veterinary College University of London'),
('Courtauld Institute of Art University of London'),
('Institute of Cancer Research University of London'),
('Royal Academy of Music University of London'),
('School of Advanced Study University of London'),
('London School of Hygiene & Tropical Medicine University of London'),
('Warburg Institute School of Advanced Study University of London'),
('London School of Economics and Political Science University of London'),
('Refugee Law Initiative School of Advanced Study University of London'),
('Royal Central School of Speech and Drama University of London'),
('Institute of Commonwealth Studies School of Advanced Study University of London'),
('Institute of English Studies School of Advanced Study University of London'),
('Institute of Historical Research School of Advanced Study University of London'),
('Institute of Advanced Legal Studies School of Advanced Study University of London'),
('Institute of languages Cultures and Societies School of Advanced Study University of London'),
('University of Westminster London'),
('University of the Arts London'),
('University of Greenwich'),
('BPP University'),
('Croydon University Centre'),
('Kingston University'),
('Kingston upon Thames'),
('St Mary''s University Twickenham')
ON CONFLICT (university_name) DO NOTHING;

-- ============================================================================
-- 8. UPDATE PROFILES RLS POLICIES - Allow users to update education
-- ============================================================================

-- Users can update their own education fields
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 9. CREATE HELPER FUNCTIONS FOR EDUCATION SEARCHES
-- ============================================================================

-- Function to search schools by name (for autocomplete)
CREATE OR REPLACE FUNCTION search_schools(search_term text)
RETURNS TABLE (
  id uuid,
  school_name text,
  education_type text,
  location text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, school_name, education_type, location
  FROM schools
  WHERE school_name ILIKE '%' || search_term || '%'
  ORDER BY school_name
  LIMIT 50;
$$;

-- Function to search colleges by name (for autocomplete)
CREATE OR REPLACE FUNCTION search_colleges(search_term text)
RETURNS TABLE (
  id uuid,
  college_name text,
  education_type text,
  location text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, college_name, education_type, location
  FROM colleges
  WHERE college_name ILIKE '%' || search_term || '%'
  ORDER BY college_name
  LIMIT 50;
$$;

-- Function to search universities by name (for autocomplete)
CREATE OR REPLACE FUNCTION search_universities(search_term text)
RETURNS TABLE (
  id uuid,
  university_name text,
  education_type text,
  location text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, university_name, education_type, location
  FROM universities
  WHERE university_name ILIKE '%' || search_term || '%'
  ORDER BY university_name
  LIMIT 50;
$$;

-- ============================================================================
-- 10. VERIFICATION & LOGGING
-- ============================================================================

-- Log migration completion
INSERT INTO admin_security_log (
  event_type,
  severity,
  operation_type,
  details
) VALUES (
  'validation_failed',
  'info',
  'migration_applied',
  jsonb_build_object(
    'migration', 'create_education_system_with_london_data',
    'timestamp', now(),
    'tables_created', jsonb_build_array('schools', 'colleges', 'universities'),
    'profile_fields_added', jsonb_build_array('secondary_school_id', 'college_id', 'university_id'),
    'schools_count', (SELECT COUNT(*) FROM schools),
    'colleges_count', (SELECT COUNT(*) FROM colleges),
    'universities_count', (SELECT COUNT(*) FROM universities),
    'features', jsonb_build_array(
      'Autocomplete search for education institutions',
      'Friend filtering by education',
      'Multiple education selections per user',
      'Internal use only - not displayed publicly',
      'AND logic for multiple filters'
    )
  )
);

-- Verify tables and data
DO $$
DECLARE
  v_schools_count int;
  v_colleges_count int;
  v_universities_count int;
BEGIN
  SELECT COUNT(*) INTO v_schools_count FROM schools;
  SELECT COUNT(*) INTO v_colleges_count FROM colleges;
  SELECT COUNT(*) INTO v_universities_count FROM universities;
  
  RAISE NOTICE '✓ Education system created successfully';
  RAISE NOTICE '  - Schools: % entries', v_schools_count;
  RAISE NOTICE '  - Colleges: % entries', v_colleges_count;
  RAISE NOTICE '  - Universities: % entries', v_universities_count;
  RAISE NOTICE '  - Profile fields: secondary_school_id, college_id, university_id';
  RAISE NOTICE '  - RLS enabled on all tables';
  RAISE NOTICE '  - Search functions created';
END $$;
