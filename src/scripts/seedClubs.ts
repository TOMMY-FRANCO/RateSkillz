import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://niurjxqttyaxmjrladrs.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pdXJqeHF0dHlheG1qcmxhZHJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MDk0MDYsImV4cCI6MjA4MTA4NTQwNn0.KoN39yci3qsM3NT7nUpns96AHh6LMy_DxUPJ3AJc6mE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NORTH_LONDON_MENS_CLUBS = [
  {
    name: 'Arsenal FC',
    region: 'North',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Islington',
    description:
      'Arsenal Football Club is a professional football club based in Islington, North London. One of the most successful clubs in English football history, playing home games at the Emirates Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Tottenham Hotspur',
    region: 'North',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Haringey',
    description:
      'Tottenham Hotspur Football Club is a professional football club based in Haringey, North London. Known as Spurs, they play at the state-of-the-art Tottenham Hotspur Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Barnet FC',
    region: 'North',
    gender: 'mens',
    league: 'National League',
    borough: 'Barnet',
    description:
      'Barnet Football Club, known as the Bees, compete in the National League. They play their home matches at The Hive Stadium in Barnet, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Enfield Town',
    region: 'North',
    gender: 'mens',
    league: 'National League South',
    borough: 'Enfield',
    description:
      'Enfield Town FC is a community football club based in Enfield, North London. They compete in the National League South and play at Queen Elizabeth II Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Haringey Borough',
    region: 'North',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Haringey',
    description:
      'Haringey Borough FC is a non-league football club based in Haringey, North London. They play in the Isthmian League at Coles Park.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Wingate and Finchley',
    region: 'North',
    gender: 'mens',
    league: 'Isthmian League Premier',
    borough: 'Barnet',
    description:
      'Wingate & Finchley FC is a non-league football club based in North London. They compete in the Isthmian League Premier Division and play at Maurice Rebak Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hendon FC',
    region: 'North',
    gender: 'mens',
    league: 'Isthmian League Premier',
    borough: 'Barnet',
    description:
      'Hendon Football Club is a semi-professional football club based in North London. They play in the Isthmian League Premier Division at Silver Jubilee Park.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const NORTH_LONDON_WOMENS_CLUBS = [
  {
    name: 'Arsenal Women',
    region: 'North',
    gender: 'womens',
    league: 'WSL',
    borough: 'Islington',
    description:
      'Arsenal Women FC is a professional women\'s football club based in Islington, North London. One of the most decorated women\'s clubs in England, playing home games at the Emirates Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Tottenham Hotspur Women',
    region: 'North',
    gender: 'womens',
    league: 'WSL',
    borough: 'Haringey',
    description:
      'Tottenham Hotspur Women FC compete in the Women\'s Super League. They play their home matches at Tottenham Hotspur Stadium in Haringey, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'London City Lionesses',
    region: 'North',
    gender: 'womens',
    league: 'WSL',
    borough: 'North London',
    description:
      'London City Lionesses are a professional women\'s football club competing in the Women\'s Super League, based in North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'London Bees',
    region: 'North',
    gender: 'womens',
    league: 'National League',
    borough: 'Harrow',
    description:
      'London Bees are a women\'s football club competing in the National League. They play their home matches at The Hive Stadium in Harrow, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Camden Town FC Women',
    region: 'North',
    gender: 'womens',
    league: 'London and South East Regional League',
    borough: 'Camden',
    description:
      'Camden Town FC Women compete in the London and South East Regional League, representing the Camden community in North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Haringey Borough FC Women',
    region: 'North',
    gender: 'womens',
    league: 'Isthmian League',
    borough: 'Haringey',
    description:
      'Haringey Borough FC Women compete in the Isthmian League, playing their home matches at Coles Park in Haringey, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hampstead Women FC',
    region: 'North',
    gender: 'womens',
    league: 'Regional',
    borough: 'Hampstead',
    description:
      'Hampstead Women FC is a women\'s football club based in Hampstead, North London, competing in regional football.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'East Finchley Women',
    region: 'North',
    gender: 'womens',
    league: 'GLWFL Division One North',
    borough: 'Barnet',
    description:
      'East Finchley Women compete in the Greater London Women\'s Football League Division One North, based in Barnet, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Alexandra Park WFC',
    region: 'North',
    gender: 'womens',
    league: 'GLWFL',
    borough: 'Muswell Hill',
    description:
      'Alexandra Park Women\'s Football Club compete in the Greater London Women\'s Football League, based in Muswell Hill, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Barnet Nightingales FC',
    region: 'North',
    gender: 'womens',
    league: 'Youth',
    borough: 'Barnet',
    description:
      'Barnet Nightingales FC is a youth women\'s football club based in Barnet, North London, developing the next generation of female footballers.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'AFC Southgate',
    region: 'North',
    gender: 'womens',
    league: 'Development',
    borough: 'Southgate',
    description:
      'AFC Southgate Women is a development women\'s football club based in Southgate, North London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'United Dragons',
    region: 'North',
    gender: 'womens',
    league: 'Grassroots',
    borough: 'Maida Vale',
    description:
      'United Dragons is a grassroots women\'s football club based in Maida Vale, North London, promoting participation and community football.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Limitless Sports FC Women',
    region: 'North',
    gender: 'womens',
    league: 'Youth',
    borough: 'Tottenham',
    description:
      'Limitless Sports FC Women is a youth women\'s football club based in Tottenham, North London, focused on developing young female talent.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Panthera FC',
    region: 'North',
    gender: 'womens',
    league: 'Grassroots',
    borough: 'Barnet',
    description:
      'Panthera FC is a grassroots women\'s football club based in Barnet, North London, providing football opportunities at the community level.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const SOUTH_LONDON_MENS_CLUBS = [
  {
    name: 'Crystal Palace',
    region: 'South',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Croydon',
    description:
      'Crystal Palace Football Club is a professional football club based in Croydon, South London. Known as the Eagles, they play their home matches at Selhurst Park.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Millwall',
    region: 'South',
    gender: 'mens',
    league: 'Championship',
    borough: 'Southwark',
    description:
      'Millwall Football Club is a professional football club based in Southwark, South London. Known as the Lions, they play their home matches at The Den.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Charlton Athletic',
    region: 'South',
    gender: 'mens',
    league: 'Championship',
    borough: 'Greenwich',
    description:
      'Charlton Athletic Football Club is a professional football club based in Greenwich, South London. Known as the Addicks, they play their home matches at The Valley.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'AFC Wimbledon',
    region: 'South',
    gender: 'mens',
    league: 'League Two',
    borough: 'Merton',
    description:
      'AFC Wimbledon is a professional football club based in Merton, South London. They play their home matches at Plough Lane, reconnecting with their spiritual home.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Bromley FC',
    region: 'South',
    gender: 'mens',
    league: 'League Two',
    borough: 'Bromley',
    description:
      'Bromley Football Club compete in League Two, playing their home matches at Hayes Lane in Bromley, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Sutton United',
    region: 'South',
    gender: 'mens',
    league: 'National League',
    borough: 'Sutton',
    description:
      'Sutton United Football Club compete in the National League, playing their home matches at Gander Green Lane in Sutton, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Dulwich Hamlet',
    region: 'South',
    gender: 'mens',
    league: 'National League South',
    borough: 'Southwark',
    description:
      'Dulwich Hamlet Football Club is a non-league football club based in Southwark, South London. They compete in the National League South and play at Champion Hill.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Welling United',
    region: 'South',
    gender: 'mens',
    league: 'National League South',
    borough: 'Bexley',
    description:
      'Welling United Football Club compete in the National League South, playing their home matches at Park View Road in Bexley, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Cray Wanderers',
    region: 'South',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Bromley',
    description:
      'Cray Wanderers Football Club is one of the oldest football clubs in the world, competing in the Isthmian League and based in Bromley, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Carshalton Athletic',
    region: 'South',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Sutton',
    description:
      'Carshalton Athletic Football Club compete in the Isthmian League, playing their home matches at War Memorial Sports Ground in Sutton, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Kingstonian',
    region: 'South',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Kingston upon Thames',
    description:
      'Kingstonian Football Club is a non-league football club based in Kingston upon Thames, South London, competing in the Isthmian League.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Tooting and Mitcham United',
    region: 'South',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Merton',
    description:
      'Tooting and Mitcham United Football Club compete in the Isthmian League, playing their home matches at Imperial Fields in Merton, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Fisher FC',
    region: 'South',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Rotherhithe',
    description:
      'Fisher Football Club is a community football club based in Rotherhithe, South London, competing in the Isthmian League.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const SOUTH_LONDON_WOMENS_CLUBS = [
  {
    name: 'Crystal Palace Women',
    region: 'South',
    gender: 'womens',
    league: 'WSL',
    borough: 'Sutton',
    description:
      'Crystal Palace Women FC compete in the Women\'s Super League, playing their home matches at VBS Community Stadium in Sutton, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Charlton Athletic Women',
    region: 'South',
    gender: 'womens',
    league: 'Championship',
    borough: 'Greenwich',
    description:
      'Charlton Athletic Women compete in the Women\'s Championship, playing their home matches at The Valley in Greenwich, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'London City Lionesses Women',
    region: 'South',
    gender: 'womens',
    league: 'WSL',
    borough: 'Southwark',
    description:
      'London City Lionesses Women compete in the Women\'s Super League, playing their home matches at The Den in Southwark, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Chelsea FC Women',
    region: 'South',
    gender: 'womens',
    league: 'WSL',
    borough: 'Kingston upon Thames',
    description:
      'Chelsea FC Women are one of the most successful women\'s clubs in England, competing in the Women\'s Super League and playing at Kingsmeadow in Kingston upon Thames.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'AFC Wimbledon Women',
    region: 'South',
    gender: 'womens',
    league: 'FA Womens National League',
    borough: 'Merton',
    description:
      'AFC Wimbledon Women compete in the FA Women\'s National League, playing their home matches at Plough Lane in Merton, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Dulwich Hamlet Women',
    region: 'South',
    gender: 'womens',
    league: 'Regional',
    borough: 'Southwark',
    description:
      'Dulwich Hamlet Women compete in regional women\'s football, playing their home matches at Champion Hill in Southwark, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Millwall Lionesses',
    region: 'South',
    gender: 'womens',
    league: 'Regional',
    borough: 'Southwark',
    description:
      'Millwall Lionesses are the women\'s football club associated with Millwall FC, competing in regional women\'s football in Southwark, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Sutton United Women',
    region: 'South',
    gender: 'womens',
    league: 'Regional',
    borough: 'Sutton',
    description:
      'Sutton United Women compete in regional women\'s football, based in Sutton, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Bromley FC Women',
    region: 'South',
    gender: 'womens',
    league: 'Regional',
    borough: 'Bromley',
    description:
      'Bromley FC Women compete in regional women\'s football, based in Bromley, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'South London Womens FC',
    region: 'South',
    gender: 'womens',
    league: 'GLWFL',
    borough: 'Clapham',
    description:
      'South London Women\'s FC compete in the Greater London Women\'s Football League, based in Clapham, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Croydon FC Women',
    region: 'South',
    gender: 'womens',
    league: 'GLWFL',
    borough: 'Croydon',
    description:
      'Croydon FC Women compete in the Greater London Women\'s Football League, representing the Croydon community in South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'AFC Greenwich Borough',
    region: 'South',
    gender: 'womens',
    league: 'Regional',
    borough: 'Greenwich',
    description:
      'AFC Greenwich Borough Women compete in regional women\'s football, based in Greenwich, South London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const EAST_LONDON_MENS_CLUBS = [
  {
    name: 'West Ham United',
    region: 'East',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Stratford',
    description:
      'West Ham United Football Club is a professional football club based in Stratford, East London. Known as the Hammers, they play their home matches at the London Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Leyton Orient',
    region: 'East',
    gender: 'mens',
    league: 'League One',
    borough: 'Leyton',
    description:
      'Leyton Orient Football Club is a professional football club based in Leyton, East London. They compete in League One and play their home matches at Brisbane Road.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Dagenham and Redbridge',
    region: 'East',
    gender: 'mens',
    league: 'National League',
    borough: 'Dagenham',
    description:
      'Dagenham and Redbridge Football Club compete in the National League, playing their home matches at Victoria Road in Dagenham, East London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Walthamstow FC',
    region: 'East',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Walthamstow',
    description:
      'Walthamstow Football Club compete in the Isthmian League, playing their home matches at Wadham Lodge in Walthamstow, East London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hornchurch FC',
    region: 'East',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Hornchurch',
    description:
      'Hornchurch Football Club compete in the Isthmian League, playing their home matches at Bridge Avenue in Hornchurch, East London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Clapton Community FC',
    region: 'East',
    gender: 'mens',
    league: 'Regional',
    borough: 'Forest Gate',
    description:
      'Clapton Community Football Club is a community-owned football club based in Forest Gate, East London, playing at the Old Spotted Dog Ground.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Barking FC',
    region: 'East',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'East London',
    description:
      'Barking Football Club compete in the Isthmian League, one of the historic non-league clubs of East London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Redbridge FC',
    region: 'East',
    gender: 'mens',
    league: 'Isthmian League',
    borough: 'Redbridge',
    description:
      'Redbridge Football Club compete in the Isthmian League, playing their home matches at Oakside Stadium in Redbridge, East London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const EAST_LONDON_WOMENS_CLUBS = [
  {
    name: 'West Ham United Women',
    region: 'East',
    gender: 'womens',
    league: 'WSL',
    borough: 'Stratford',
    description:
      "West Ham United Women compete in the Women's Super League, playing their home matches at the London Stadium in Stratford, East London.",
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'London Seaward FC',
    region: 'East',
    gender: 'womens',
    league: 'FA Womens National League',
    borough: 'East London',
    description:
      "London Seaward FC compete in the FA Women's National League, representing East London women's football.",
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'AFC Leyton',
    region: 'East',
    gender: 'womens',
    league: 'Development',
    borough: 'Walthamstow',
    description:
      'AFC Leyton Women are a development-level women\'s football club based in Walthamstow, East London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const WEST_LONDON_MENS_CLUBS = [
  {
    name: 'Chelsea FC',
    region: 'West',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Fulham',
    description:
      'Chelsea Football Club is a professional football club based in Fulham, West London. One of the most decorated clubs in English football, they play at Stamford Bridge.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Fulham FC',
    region: 'West',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Fulham',
    description:
      'Fulham Football Club is a professional football club based in Fulham, West London. Known as the Cottagers, they play their home matches at Craven Cottage.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Brentford FC',
    region: 'West',
    gender: 'mens',
    league: 'Premier League',
    borough: 'Brentford',
    description:
      'Brentford Football Club is a professional football club based in Brentford, West London. They play their home matches at the Gtech Community Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Queens Park Rangers',
    region: 'West',
    gender: 'mens',
    league: 'Championship',
    borough: "Shepherd's Bush",
    description:
      "Queens Park Rangers Football Club is a professional football club based in Shepherd's Bush, West London. Known as the Hoops, they play at Loftus Road.",
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Wealdstone FC',
    region: 'West',
    gender: 'mens',
    league: 'National League',
    borough: 'Ruislip',
    description:
      'Wealdstone Football Club compete in the National League, playing their home matches at Grosvenor Vale in Ruislip, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hampton and Richmond Borough',
    region: 'West',
    gender: 'mens',
    league: 'National League South',
    borough: 'Hampton',
    description:
      'Hampton and Richmond Borough Football Club compete in the National League South, playing their home matches at Beveree Stadium in Hampton, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hanwell Town',
    region: 'West',
    gender: 'mens',
    league: 'Southern League',
    borough: 'Perivale',
    description:
      'Hanwell Town Football Club compete in the Southern League, based in Perivale, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Harrow Borough',
    region: 'West',
    gender: 'mens',
    league: 'Non-League',
    borough: 'Harrow',
    description:
      'Harrow Borough Football Club is a non-league football club based in Harrow, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hayes and Yeading United',
    region: 'West',
    gender: 'mens',
    league: 'Non-League',
    borough: 'Hayes',
    description:
      'Hayes and Yeading United Football Club is a non-league football club based in Hayes, West London, playing at Skyex Community Stadium.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Wembley FC',
    region: 'West',
    gender: 'mens',
    league: 'Spartan South Midlands League',
    borough: 'Wembley',
    description:
      'Wembley Football Club compete in the Spartan South Midlands League, playing their home matches at Vale Farm in Wembley, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Northwood FC',
    region: 'West',
    gender: 'mens',
    league: 'Southern League Central',
    borough: 'Northwood',
    description:
      'Northwood Football Club compete in the Southern League Central Division, based in Northwood, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const WEST_LONDON_WOMENS_CLUBS = [
  {
    name: 'Fulham FC Women',
    region: 'West',
    gender: 'womens',
    league: 'Professional',
    borough: 'Fulham',
    description:
      'Fulham FC Women are the professional women\'s team associated with Fulham FC, based in Fulham, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Brentford Women FC',
    region: 'West',
    gender: 'womens',
    league: 'London and South East Regional',
    borough: 'Brentford',
    description:
      'Brentford Women FC compete in the London and South East Regional League, based in Brentford, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'United Dragons FC Women',
    region: 'West',
    gender: 'womens',
    league: 'Community',
    borough: 'Maida Vale',
    description:
      'United Dragons FC Women is a community women\'s football club based in Maida Vale, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Shepherds Booters FC',
    region: 'West',
    gender: 'womens',
    league: 'Community',
    borough: "Shepherd's Bush",
    description:
      "Shepherds Booters FC are a community women's football club based in Shepherd's Bush, West London.",
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Gals FC',
    region: 'West',
    gender: 'womens',
    league: 'Recreational',
    borough: 'Ealing',
    description:
      'Gals FC is a recreational women\'s football club based at Lammas Park in Ealing, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Hammersmith FC Women',
    region: 'West',
    gender: 'womens',
    league: 'Community',
    borough: 'Hammersmith',
    description:
      'Hammersmith FC Women is a community women\'s football club based in Hammersmith, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Foxes FC Academy',
    region: 'West',
    gender: 'womens',
    league: 'Youth',
    borough: 'West London',
    description:
      'Foxes FC Academy is a youth women\'s football development club based in West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Actonians LFC',
    region: 'West',
    gender: 'womens',
    league: 'Womens Football',
    borough: 'Ealing',
    description:
      'Actonians LFC is a women\'s football club based in Ealing, West London, with a long history in the women\'s game.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
  {
    name: 'Southall Athletic WFC',
    region: 'West',
    gender: 'womens',
    league: 'Local League',
    borough: 'Southall',
    description:
      'Southall Athletic WFC compete in local league women\'s football, based in Southall, West London.',
    badge_url: null,
    is_verified: false,
    is_partner: false,
  },
] as const;

const ALL_CLUBS = [
  ...NORTH_LONDON_MENS_CLUBS,
  ...NORTH_LONDON_WOMENS_CLUBS,
  ...SOUTH_LONDON_MENS_CLUBS,
  ...SOUTH_LONDON_WOMENS_CLUBS,
  ...EAST_LONDON_MENS_CLUBS,
  ...EAST_LONDON_WOMENS_CLUBS,
  ...WEST_LONDON_MENS_CLUBS,
  ...WEST_LONDON_WOMENS_CLUBS,
];

export async function runSeed(): Promise<{ inserted: number; skipped: number }> {
  const { data: existing, error: fetchError } = await supabase
    .from('football_clubs')
    .select('name');

  if (fetchError) {
    throw new Error(`Failed to fetch existing clubs: ${fetchError.message}`);
  }

  const existingNames = new Set((existing || []).map((c: { name: string }) => c.name));
  const toInsert = ALL_CLUBS.filter(c => !existingNames.has(c.name));

  if (toInsert.length === 0) {
    return { inserted: 0, skipped: ALL_CLUBS.length };
  }

  const { error: insertError } = await supabase.from('football_clubs').insert(toInsert as any[]);

  if (insertError) {
    throw new Error(`Insert failed: ${insertError.message}`);
  }

  return { inserted: toInsert.length, skipped: existingNames.size };
}

export default runSeed;

async function seedClubs() {
  console.log('Starting club seed...');
  try {
    const { inserted, skipped } = await runSeed();
    if (inserted === 0) {
      console.log('All clubs already exist — nothing to insert.');
    } else {
      console.log(`Inserted ${inserted} club(s). ${skipped} already existed.`);
    }
    console.log('Seed complete.');
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

seedClubs();
