import json

categories = [
    # On-campus
    ("lecture", "Lecture Theatre", [
        ("lt1", "Lecture Theatre 1 (LT1)", "Main 500-seat lecture hall near School of Science", 9.5255, 6.4498),
        ("lt2", "Lecture Theatre 2 (LT2)", "School of Engineering lecture theatre", 9.5262, 6.4510),
        ("lt3", "Lecture Theatre 3 (LT3)", "School of Environmental Technology lecture hall", 9.5270, 6.4520),
        ("lt4", "Lecture Theatre 4 (LT4)", "School of Information & Comm Tech hall", 9.5248, 6.4485),
        ("nlt1", "New Lecture Theatre 1", "Newly built 1000-seater capacity hall", 9.5280, 6.4535),
        ("nlt2", "New Lecture Theatre 2", "Modern air-conditioned lecture complex", 9.5285, 6.4542),
        ("clt", "Central Lecture Theatre", "University central lecture auditorium", 9.5250, 6.4505),
        ("agric-lt", "SAAT Lecture Theatre", "School of Agriculture & Agricultural Tech hall", 9.5235, 6.4470),
        ("step-lt", "SSTE Lecture Hall", "School of Science & Tech Education hall", 9.5290, 6.4550),
        ("sls-lt", "SLS Lecture Theatre", "School of Life Sciences lecture hall", 9.5240, 6.4490),
    ]),
    ("hostel", "Hostel", [
        ("h-male-a", "Block A Male Hostel", "Undergraduate male residence block A", 9.5210, 6.4450),
        ("h-male-b", "Block B Male Hostel", "Undergraduate male residence block B", 9.5215, 6.4458),
        ("h-male-c", "Block C Male Hostel", "Undergraduate male residence block C", 9.5220, 6.4465),
        ("h-male-d", "Block D Male Hostel", "New male hostel block D", 9.5225, 6.4472),
        ("h-fem-a", "Block A Female Hostel", "Undergraduate female residence block A", 9.5310, 6.4570),
        ("h-fem-b", "Block B Female Hostel", "Undergraduate female residence block B", 9.5315, 6.4578),
        ("h-fem-c", "Block C Female Hostel", "Undergraduate female residence block C", 9.5320, 6.4585),
        ("h-pg-male", "PG Male Hostel", "Postgraduate male residential quarters", 9.5330, 6.4590),
        ("h-pg-fem", "PG Female Hostel", "Postgraduate female residential quarters", 9.5335, 6.4595),
        ("h-conv-male", "Convocation Male Hostel", "Convocation village hostel A", 9.5205, 6.4440),
    ]),
    ("gate", "Gate", [
        ("gk-main-gate", "Gidan Kwano Main Gate", "Primary campus entrance gate off Minna-Zungeru Rd", 9.5200, 6.4420),
        ("gk-back-gate", "GK Back Gate", "Secondary gate towards Western bypass", 9.5340, 6.4610),
        ("gk-north-gate", "GK North Gate", "North exit towards Maikunkele axis", 9.5350, 6.4620),
        ("bosso-main-gate", "Bosso Campus Main Gate", "Main gate of Bosso campus", 9.6135, 6.5460),
        ("bosso-sec-gate", "Bosso Secondary Gate", "Bosso campus back exit gate", 9.6145, 6.5475),
    ]),
    ("library", "Library", [
        ("main-lib", "University Main Library", "Central university library building & e-library", 9.5265, 6.4500),
        ("seet-lib", "SEET School Library", "School of Engineering specialized library", 9.5268, 6.4512),
        ("ict-lib", "SICT E-Library", "Digital library & research centre", 9.5245, 6.4480),
        ("bosso-lib", "Bosso Campus Library", "Library branch at Bosso campus", 9.6140, 6.5465),
    ]),
    ("blocks", "Admin / General Block", [
        ("admin-block-a", "Admin Block A", "Registry & Student Affairs offices", 9.5258, 6.4492),
        ("admin-block-b", "Admin Block B", "Bursary & Financial Services block", 9.5260, 6.4495),
        ("seet-block", "SEET Admin Block", "Dean's office - Engineering", 9.5264, 6.4508),
        ("sict-block", "SICT Admin Block", "Dean's office - Information Tech", 9.5246, 6.4482),
        ("saat-block", "SAAT Admin Block", "Dean's office - Agriculture", 9.5233, 6.4468),
        ("set-block", "SET Admin Block", "Dean's office - Environmental Tech", 9.5272, 6.4522),
    ]),
    ("medical", "Medical Centre", [
        ("gk-clinic", "Gidan Kwano Health Centre", "University clinic & emergency ward", 9.5230, 6.4460),
        ("bosso-clinic", "Bosso Campus Clinic", "Medical outpost at Bosso campus", 9.6130, 6.5450),
        ("pharmacy", "University Pharmacy", "Dispensary and medical store", 9.5232, 6.4462),
    ]),
    ("sports", "Sports Facility", [
        ("sports-complex", "Main Sports Complex", "Football pitch & athletics track", 9.5295, 6.4560),
        ("indoor-sports", "Indoor Sports Hall", "Basketball, badminton, and table tennis court", 9.5298, 6.4565),
        ("volleyball-court", "Volleyball Court", "Outdoor volleyball arena near hostel A", 9.5212, 6.4452),
        ("tennis-court", "Lawn Tennis Court", "University tennis facility", 9.5292, 6.4558),
    ]),
    ("ict", "ICT Centre", [
        ("ict-centre-main", "Main ICT Centre", "CBT exam centre & university server room", 9.5242, 6.4478),
        ("cbt-hall-a", "CBT Hall A", "Digital testing centre 500-workstation hall", 9.5244, 6.4481),
        ("cbt-hall-b", "CBT Hall B", "Digital testing centre 300-workstation hall", 9.5246, 6.4484),
        ("ict-helpdesk", "ICT Support Desk", "Student portal & email support office", 9.5240, 6.4475),
    ]),
    ("canteen", "Canteen / Cafeteria", [
        ("central-cafeteria", "Central Student Cafeteria", "Main student food court & dining area", 9.5252, 6.4488),
        ("hostel-buttery", "Hostel Buttery Market", "Snack shops & provisions center near hostel B", 9.5218, 6.4460),
        ("staff-club-canteen", "Staff Club Restaurant", "University staff cafeteria & lounge", 9.5275, 6.4528),
        ("seet-canteen", "SEET Food Kiosk", "Refreshment spot near Engineering block", 9.5266, 6.4514),
    ]),
    ("worship", "Place of Worship", [
        ("central-mosque", "University Central Mosque", "Gidan Kwano main campus mosque complex", 9.5248, 6.4496),
        ("rcf-chapel", "RCF Fellowship Centre", "Redeemed Campus Fellowship auditorium", 9.5302, 6.4572),
        ("chapel-grace", "Chapel of Grace", "Interdenominational campus worship center", 9.5305, 6.4575),
        ("nifs-mosque", "MSSN Islamic Centre", "Muslim Students Society worship hall", 9.5250, 6.4498),
        ("fcs-auditorium", "FCS Campus Auditorium", "Fellowship of Christian Students hall", 9.5308, 6.4578),
    ]),
    ("laboratory", "Laboratory", [
        ("chem-lab", "Central Chemistry Lab", "Advanced chemical analysis lab", 9.5257, 6.4494),
        ("physics-lab", "Physics Research Lab", "Experimental physics laboratory", 9.5259, 6.4497),
        ("bio-lab", "Biological Sciences Lab", "Microbiology & genetics lab", 9.5241, 6.4491),
        ("civil-eng-lab", "Civil Engineering Lab", "Concrete & hydraulics testing facility", 9.5263, 6.4511),
        ("elect-lab", "Electrical Eng Hardware Lab", "Circuits & robotics lab", 9.5265, 6.4513),
        ("mech-lab", "Mechanical Thermo Lab", "Thermodynamics & IC engines lab", 9.5267, 6.4515),
    ]),
    ("workshop", "Workshop / Tech Lab", [
        ("eng-workshop-main", "Central Engineering Workshop", "Machining, welding & fabrication workshop", 9.5269, 6.4518),
        ("woodwork-shop", "Carpentry & Wood Workshop", "Environmental Tech wood model workshop", 9.5273, 6.4524),
        ("foundry-shop", "Foundry & Casting Shop", "Metallurgical engineering casting lab", 9.5271, 6.4520),
        ("auto-workshop", "Automobile Mechanics Shop", "Vehicle diagnostic & repair workshop", 9.5268, 6.4516),
    ]),
    ("auditorium", "Auditorium / Hall", [
        ("convocation-square", "Convocation Square", "Grand open-air convocation ceremony arena", 9.5288, 6.4545),
        ("multipurpose-hall", "Multipurpose Hall", "University indoor events & orientation hall", 9.5282, 6.4538),
        ("senate-chamber-hall", "Senate Chamber Hall", "Official university conference auditorium", 9.5278, 6.4532),
    ]),
    ("parking", "Parking Area", [
        ("main-gate-parking", "Main Gate Bus Terminal & Park", "Campus shuttle bus stop and car park", 9.5202, 6.4425),
        ("admin-parking", "Senate Admin Car Park", "Staff & official visitors parking lot", 9.5277, 6.4530),
        ("library-parking", "Library Visitors Park", "Student & researcher vehicle parking", 9.5263, 6.4498),
        ("hostel-car-park", "Student Hostel Car Park", "Overnight vehicle park near Hostels", 9.5213, 6.4455),
    ]),
    ("faculty", "Faculty / Department Office", [
        ("cs-dept", "Computer Science Dept Office", "Department of Computer Science HOD office", 9.5247, 6.4483),
        ("cyber-dept", "Cyber Security Dept", "Cyber Security Science offices & lab", 9.5249, 6.4486),
        ("mech-dept", "Mechanical Eng Dept", "Mechanical Engineering offices", 9.5266, 6.4512),
        ("civil-dept", "Civil Eng Dept", "Civil Engineering HOD office", 9.5261, 6.4507),
        ("arch-dept", "Architecture Dept", "Architecture studios & offices", 9.5274, 6.4523),
        ("stat-dept", "Statistics Dept", "Mathematics & Statistics offices", 9.5256, 6.4493),
    ]),
    ("senate", "Senate / Admin Directorate", [
        ("senate-building", "Senate Building", "Vice-Chancellor's office & central administration", 9.5276, 6.4531),
        ("academic-planning", "Academic Planning Directorate", "Curriculum & accreditation offices", 9.5279, 6.4534),
        ("research-directorate", "Directorate of Research & Innovation", "Grant management & research hub", 9.5281, 6.4536),
    ]),

    # ── Off-campus Minna Regional Locations ──
    ("bosso", "Bosso", [
        ("bosso-market", "Bosso Market", "Popular local market in Bosso town", 9.6150, 6.5480),
        ("bosso-estate", "Bosso Lowcost Estate", "Residential housing estate in Bosso", 9.6170, 6.5490),
        ("bosso-waterboard", "Bosso Water Works", "Water treatment station landmark", 9.6120, 6.5440),
        ("bosso-express-junction", "Bosso Express Junction", "Major road junction along Bosso road", 9.6160, 6.5470),
    ]),
    ("talba", "Talba", [
        ("talba-estate-gate", "Talba Housing Estate Main Gate", "Gated residential estate gate along GK road", 9.5420, 6.4810),
        ("talba-commercial", "Talba Commercial Center", "Shops and pharmacy complex in Talba", 9.5430, 6.4825),
        ("talba-phase2", "Talba Estate Phase 2", "Secondary residential section", 9.5445, 6.4840),
    ]),
    ("kpakungu", "Kpakungu", [
        ("kpakungu-roundabout", "Kpakungu Roundabout", "Major transit roundabout connecting GK to Minna city", 9.5890, 6.5340),
        ("kpakungu-filling-station", "Total Filling Station Kpakungu", "Prominent landmark at Kpakungu junction", 9.5895, 6.5348),
        ("kpakungu-express", "Kpakungu Western Bypass Join", "Expressway turnoff point", 9.5880, 6.5330),
        ("kpakungu-market", "Kpakungu Local Market", "Neighborhood food market", 9.5905, 6.5355),
    ]),
    ("maitumbi", "Maitumbi", [
        ("maitumbi-junction", "Maitumbi Main Junction", "Busy intersection leading to Shiroro road", 9.6350, 6.5700),
        ("maitumbi-day-sec", "Maitumbi Day Secondary School", "Public school landmark", 9.6370, 6.5720),
        ("maitumbi-market", "Maitumbi Central Market", "Community trade center", 9.6330, 6.5680),
    ]),
    ("tunga", "Tunga", [
        ("tunga-roundabout", "Tunga Roundabout", "Central Minna roundabout near Mobil station", 9.6050, 6.5600),
        ("tunga-lowcost", "Tunga Lowcost Estate", "Popular residential layout in Tunga", 9.6080, 6.5630),
        ("mko-park-tunga", "MKO Abiola Park Tunga", "Public recreational park", 9.6040, 6.5590),
    ]),
    ("chanchaga", "Chanchaga", [
        ("chanchaga-bridge", "Chanchaga Bridge", "Historic river bridge on Minna-Suleja highway", 9.5600, 6.5800),
        ("chanchaga-water-board", "State Water Board Chanchaga", "Water treatment plant landmark", 9.5620, 6.5820),
    ]),
    ("minna_central", "Minna Central", [
        ("minna-central-market", "Minna Central Market (Obasanjo Complex)", "Main commercial hub of Minna", 9.6158, 6.5569),
        ("post-office-minna", "Minna General Post Office", "Federal post office building", 9.6140, 6.5550),
        ("emir-palace-minna", "Emir of Minna Palace", "Royal palace complex in Minna city center", 9.6180, 6.5590),
        ("city-plaza-minna", "City Plaza Shopping Mall", "Retail and supermarket center", 9.6150, 6.5560),
    ]),
    ("kwamba", "Kwamba", [
        ("kwamba-junction", "Kwamba Junction", "Residential suburb turnoff", 9.5950, 6.5450),
        ("kwamba-layout", "Kwamba New Extension", "Housing layout near Kpakungu axis", 9.5970, 6.5470),
    ]),
    ("sango", "Sango", [
        ("sango-roundabout", "Sango Roundabout", "Transit hub near Bosso", 9.6220, 6.5520),
        ("sango-commercial", "Sango Shopping Strip", "Electronics and phone accessories market", 9.6235, 6.5535),
    ]),
    ("dutsen_kura", "Dutsen Kura", [
        ("dutsen-kura-hausawa", "Dutsen Kura Hausawa", "Popular residential community", 9.6100, 6.5420),
        ("dutsen-kura-gwari", "Dutsen Kura Gwari", "Neighborhood near Bosso road", 9.6115, 6.5435),
    ]),
    ("barkin_sale", "Barkin Sale", [
        ("barkin-sale-junction", "Barkin Sale Junction", "Turnoff into Barkin Sale residential zone", 9.6280, 6.5620),
    ]),
    ("mobile", "Mobile Layout", [
        ("mobile-layout-gate", "Mobile Layout Entrance", "Gated residential layout near Tunga", 9.6020, 6.5540),
        ("mobile-park", "Mobile Park Bus Stop", "Intra-city bus and taxi park", 9.6010, 6.5530),
    ]),
    ("gbangban", "Gbangban", [
        ("gbangban-village", "Gbangban Settlement", "Community area along GK corridor", 9.5350, 6.4700),
    ]),
    ("sauka_kahuta", "Sauka Kahuta", [
        ("sauka-kahuta-express", "Sauka Kahuta Junction", "Expressway junction near Police HQ", 9.5980, 6.5490),
    ]),
    ("shango", "Shango", [
        ("shango-market", "Shango Junction Market", "Suburban market along Suleja road", 9.5700, 6.5750),
    ]),
    ("aliyu_makama", "Aliyu Makama Road", [
        ("aliyu-makama-junction", "Aliyu Makama Road Junction", "Major commercial street in Tunga", 9.6065, 6.5615),
    ]),
    ("paikon_kore", "Paikon Kore", [
        ("paikon-kore-center", "Paikon Kore Center", "Suburban township near Minna perimeter", 9.5500, 6.5000),
    ]),
    ("maikunkele", "Maikunkele", [
        ("maikunkele-airport-junction", "Maikunkele Airport Junction", "Turnoff to Minna International Airport", 9.6500, 6.5100),
        ("maikunkele-market", "Maikunkele Town Market", "Township market square", 9.6520, 6.5120),
    ]),
    ("ibb_way", "IBB Way", [
        ("ibb-way-bank-strip", "IBB Way Banking Boulevard", "Commercial strip with FirstBank, GTBank, Zenith", 9.6130, 6.5530),
        ("nysc-secretariat", "NYSC State Secretariat IBB Way", "State NYSC headquarters", 9.6110, 6.5510),
    ]),
    ("airport_road", "Airport Road", [
        ("minna-airport-gate", "Minna Airport Main Gate", "Minna International Airport entrance", 9.6600, 6.5000),
    ]),
    ("wushishi", "Wushishi", [
        ("wushishi-housing", "Wushishi Housing Estate", "State government residential estate", 9.6250, 6.5650),
    ]),
    ("faith_gate", "Faith Gate Area", [
        ("faith-gate-junction", "Faith Gate Junction", "Student residential area right outside GK campus", 9.5180, 6.4400),
        ("faith-gate-plaza", "Faith Gate Student Plaza", "Laundry, print shops, and provisions store", 9.5175, 6.4395),
    ]),
    ("others", "Others", [
        ("customs-office-minna", "Customs Area Command Minna", "Federal customs office", 9.6090, 6.5500),
        ("police-hq-minna", "State Police Headquarters", "Niger State police Command HQ", 9.5990, 6.5510),
        ("nTA-minna", "NTA Minna Station", "National Television Authority station", 9.6070, 6.5580),
        ("radio-niger", "Radio Niger House", "State broadcasting service office", 9.6080, 6.5585),
    ]),
]

all_locations = []

for cat_id, cat_label, locs in categories:
    for item in locs:
        loc_id, name, desc, lat, lng = item
        all_locations.append({
            "id": loc_id,
            "name": name,
            "description": desc,
            "latitude": lat,
            "longitude": lng,
            "category": cat_id,
            "is_active": True,
            "allow_overlap": True
        })

print(f"Total locations generated: {len(all_locations)}")

with open("c:/Users/DELL/Desktop/Apps/LR-Ride/backend/sample_locations_120.json", "w") as f:
    json.dump(all_locations, f, indent=2)

