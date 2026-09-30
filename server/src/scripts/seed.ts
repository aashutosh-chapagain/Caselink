import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import Workspace from '../models/Workspace';
import User from '../models/User';
import CaseModel from '../models/Case';
import Activity from '../models/Activity';
import Alert from '../models/Alert';
import Invite from '../models/Invite';
import Notification from '../models/Notification';

dotenv.config();

async function seed() {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('Connected. Clearing existing data...');

    await Promise.all([
        Workspace.deleteMany({}),
        User.deleteMany({}),
        CaseModel.deleteMany({}),
        Activity.deleteMany({}),
        Alert.deleteMany({}),
        Invite.deleteMany({}),
        Notification.deleteMany({}),
    ]);

    const workspace = await Workspace.create({ name: 'DFES Perth Metro' });
    const wid = workspace._id;
    const passwordHash = await bcrypt.hash('password123', 10);

    // --- Users ---
    const admin = await User.create({
        name: 'Ash Reynolds',
        email: 'admin@caselink.test',
        passwordHash,
        role: 'admin',
        workspaceId: wid,
    });

    const [sarah, marcus, priya, tom] = await User.insertMany([
        { name: 'Sarah Chen',      email: 'sarah@caselink.test',   passwordHash, role: 'caseworker', workspaceId: wid },
        { name: 'Marcus Webb',     email: 'marcus@caselink.test',  passwordHash, role: 'caseworker', workspaceId: wid },
        { name: 'Priya Nair',      email: 'priya@caselink.test',   passwordHash, role: 'caseworker', workspaceId: wid },
        { name: 'Tom Gallagher',   email: 'tom@caselink.test',     passwordHash, role: 'caseworker', workspaceId: wid },
    ]);

    // helpers
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000);

    // --- Cases ---
    const cases = await CaseModel.insertMany([

        // ── CRITICAL / open ──────────────────────────────────────────────
        {
            title: 'Structure fire — Hay Street terrace, Subiaco',
            description: 'Two-storey terrace house well alight on arrival. Crews from Subiaco and West Perth stations responding. Occupant reported unaccounted for. Neighbours evacuated to laneway.',
            status: 'open',
            priority: 'critical',
            type: 'fire',
            region: 'Subiaco',
            address: '12 Hay Street, Subiaco WA 6008, Australia',
            lat: -31.9481, lng: 115.8267,
            assignedTo: marcus._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(1),
            createdAt: daysAgo(0),
        },
        {
            title: 'Grassfire threatening homes — Serpentine',
            description: 'Fast-moving grass fire fanned by easterly winds. Fire front approximately 400 metres wide approaching residential lots on Serpentine Road. Two suppression units on scene, air support requested.',
            status: 'open',
            priority: 'critical',
            type: 'fire',
            region: 'Serpentine',
            address: 'Serpentine Road, Serpentine WA 6203, Australia',
            lat: -32.3809, lng: 116.0024,
            assignedTo: sarah._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(0),
            createdAt: daysAgo(0),
        },
        {
            title: 'Missing person — Kings Park bushland',
            description: 'Male, 74, with early-stage dementia last seen at 07:40 near the War Memorial car park. Family notified police and DFES. GPS tracker not on person. Search team of 12 deployed through bushland trails.',
            status: 'open',
            priority: 'critical',
            type: 'missing_person',
            region: 'Kings Park',
            address: 'Fraser Avenue, Kings Park WA 6005, Australia',
            lat: -31.9601, lng: 115.8329,
            assignedTo: priya._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(0),
            createdAt: daysAgo(1),
        },
        {
            title: 'Hazmat spill — Kwinana industrial precinct',
            description: 'Tanker rollover on Kwinana Beach Road has released approximately 2,000 litres of hydrochloric acid. 200-metre exclusion zone established. Three workers with chemical burns awaiting medical evacuation. EPA notified.',
            status: 'open',
            priority: 'critical',
            type: 'hazmat',
            region: 'Kwinana',
            address: 'Kwinana Beach Road, Kwinana WA 6167, Australia',
            lat: -32.2390, lng: 115.7741,
            assignedTo: tom._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(1),
            createdAt: daysAgo(0),
        },

        // ── CRITICAL / in_progress ────────────────────────────────────────
        {
            title: 'Roof collapse with entrapment — warehouse, Canning Vale',
            description: 'Partial roof collapse at a commercial storage facility following structural failure. Two workers reported trapped under debris. Heavy rescue unit on scene. USAR team requested from Belmont.',
            status: 'in_progress',
            priority: 'critical',
            type: 'rescue',
            region: 'Canning Vale',
            address: '8 Ranford Road, Canning Vale WA 6155, Australia',
            lat: -32.0780, lng: 115.9314,
            assignedTo: marcus._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(0),
            createdAt: daysAgo(1),
        },
        {
            title: 'Missing teenager — Scarborough Beach foreshore',
            description: 'Female, 16, last seen swimming at northern end of Scarborough Beach at 17:20. Friends reported she did not return to shore. Surf Life Saving WA notified, water police vessel deployed. Rip current in area.',
            status: 'in_progress',
            priority: 'critical',
            type: 'missing_person',
            region: 'Scarborough',
            address: 'The Esplanade, Scarborough WA 6019, Australia',
            lat: -31.8936, lng: 115.7605,
            assignedTo: priya._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(2),
        },

        // ── HIGH / open ───────────────────────────────────────────────────
        {
            title: 'Welfare check — elderly resident, Armadale',
            description: 'Neighbour reported 81-year-old woman has not collected mail for four days. No response to door knocks. Son living in Brisbane requests urgent welfare check. Property at end of long driveway with locked gate.',
            status: 'open',
            priority: 'high',
            type: 'welfare_check',
            region: 'Armadale',
            address: '14 Jull Street, Armadale WA 6112, Australia',
            lat: -32.1436, lng: 116.0152,
            assignedTo: sarah._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(2),
            createdAt: daysAgo(3),
        },
        {
            title: 'Welfare check — child at risk, Balga',
            description: 'School has reported child, aged 9, has been absent for 11 school days. No contact from parents. Previous DCP involvement on file. Caseworker and police to attend jointly.',
            status: 'open',
            priority: 'high',
            type: 'welfare_check',
            region: 'Balga',
            address: '42 Mirrabooka Avenue, Balga WA 6061, Australia',
            lat: -31.8519, lng: 115.8418,
            assignedTo: priya._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(1),
            createdAt: daysAgo(4),
        },
        {
            title: 'Search and rescue — missing hiker, Yanchep National Park',
            description: 'Male, 34, overdue return from solo overnight hike on the Yanchep Lagoon Trail. Last contact via SPOT device at 14:30 yesterday from grid reference approximately 5 km north-east of the main car park. Trail unlit.',
            status: 'open',
            priority: 'high',
            type: 'missing_person',
            region: 'Yanchep',
            address: 'Yanchep National Park, Yanchep WA 6035, Australia',
            lat: -31.5505, lng: 115.6904,
            assignedTo: tom._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(0),
            createdAt: daysAgo(1),
        },
        {
            title: 'Industrial injury — Henderson Marine Precinct',
            description: 'Dockworker sustained crush injury to lower limbs during crane operations at a vessel repair facility. WorkSafe notified. Patient airlifted to Fiona Stanley Hospital. Next of kin contacted.',
            status: 'open',
            priority: 'high',
            type: 'medical',
            region: 'Henderson',
            address: '7 Quill Way, Henderson WA 6166, Australia',
            lat: -32.1527, lng: 115.7796,
            assignedTo: marcus._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(3),
            createdAt: daysAgo(2),
        },

        // ── HIGH / in_progress ────────────────────────────────────────────
        {
            title: 'Medical assist — cardiac event, Joondalup',
            description: 'Male, 58, collapsed in the Grand Boulevard Woolworths car park. CPR performed by bystanders. Ambulance on scene. DFES supporting for extrication and crowd management. Transferred to Joondalup Health Campus.',
            status: 'in_progress',
            priority: 'high',
            type: 'medical',
            region: 'Joondalup',
            address: 'Grand Boulevard, Joondalup WA 6027, Australia',
            lat: -31.7440, lng: 115.7665,
            assignedTo: sarah._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(5),
        },
        {
            title: 'Storm damage — residence, Mandurah',
            description: 'Severe storm has brought large tree through roof of single-storey dwelling. Elderly couple sheltering in rear bedroom, uninjured but unable to exit safely. Power and gas to property isolated. Chainsaw crew en route.',
            status: 'in_progress',
            priority: 'high',
            type: 'rescue',
            region: 'Mandurah',
            address: '23 Pinjarra Road, Mandurah WA 6210, Australia',
            lat: -32.5295, lng: 115.7218,
            assignedTo: tom._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(1),
            createdAt: daysAgo(3),
        },
        {
            title: 'Welfare support — domestic situation, Midvale',
            description: 'Repeat call-out to address. Female and two children reported to be without food, utilities disconnected. Caseworker attending with emergency relief package. Referral to housing authority initiated.',
            status: 'in_progress',
            priority: 'high',
            type: 'welfare_check',
            region: 'Midvale',
            address: '97 Morrison Road, Midvale WA 6056, Australia',
            lat: -31.8780, lng: 116.0251,
            assignedTo: priya._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(6),
        },
        {
            title: 'Vessel rescue — offshore Rottnest Island',
            description: 'Recreational vessel with four persons aboard taking on water 2.2 nautical miles south-east of Thomson Bay. One person with suspected hypothermia. Marine Rescue WA vessel and DFES hovercraft dispatched.',
            status: 'in_progress',
            priority: 'high',
            type: 'rescue',
            region: 'Rottnest Island',
            address: 'Thomson Bay, Rottnest Island WA 6161, Australia',
            lat: -32.0070, lng: 114.9780,
            assignedTo: marcus._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(4),
        },

        // ── MEDIUM / open ─────────────────────────────────────────────────
        {
            title: 'Gas leak — residential terrace, Maylands',
            description: 'Resident reports strong smell of gas since last night. Atco gas network notified. Property evacuated, neighbouring units informed. Gas supply isolated at street level pending inspection.',
            status: 'open',
            priority: 'medium',
            type: 'hazmat',
            region: 'Maylands',
            address: '88 Guildford Road, Maylands WA 6051, Australia',
            lat: -31.9283, lng: 115.8888,
            assignedTo: sarah._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(2),
            createdAt: daysAgo(7),
        },
        {
            title: 'Welfare check — Mandurah aged care community',
            description: 'Three residents of an independent living complex have not responded to wellness calls for 48 hours following the facility\'s weekend staff shortage. Caseworker to attend and confirm wellbeing.',
            status: 'open',
            priority: 'medium',
            type: 'welfare_check',
            region: 'Mandurah',
            address: '101 Mandurah Road, Mandurah WA 6210, Australia',
            lat: -32.5327, lng: 115.7223,
            assignedTo: tom._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(5),
            createdAt: daysAgo(8),
        },
        {
            title: 'Hazmat — solvent drums abandoned, Kewdale',
            description: 'Council rangers discovered four unlabelled 200-litre drums leaking near the Kewdale light industrial precinct. DFES hazmat team to assess and coordinate disposal through licensed contractor.',
            status: 'open',
            priority: 'medium',
            type: 'hazmat',
            region: 'Kewdale',
            address: 'Kewdale Road, Kewdale WA 6105, Australia',
            lat: -31.9714, lng: 115.9527,
            assignedTo: marcus._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(7),
            createdAt: daysAgo(5),
        },
        {
            title: 'Medical support — post-discharge care, Mirrabooka',
            description: 'Male, 67, discharged from Sir Charles Gairdner Hospital following hip replacement. Lives alone, no carer support organised. Home visit required to assess mobility, medication management, and meal access.',
            status: 'open',
            priority: 'medium',
            type: 'medical',
            region: 'Mirrabooka',
            address: '55 Mirrabooka Avenue, Mirrabooka WA 6061, Australia',
            lat: -31.8607, lng: 115.8478,
            assignedTo: priya._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(4),
            createdAt: daysAgo(9),
        },

        // ── MEDIUM / in_progress ──────────────────────────────────────────
        {
            title: 'Welfare follow-up — family support, Northbridge',
            description: 'Initial welfare visit completed last week. Family of five identified as requiring ongoing support following father\'s hospitalisation. Second visit to confirm school enrolment for children and link to food bank referral.',
            status: 'in_progress',
            priority: 'medium',
            type: 'welfare_check',
            region: 'Northbridge',
            address: '100 James Street, Northbridge WA 6003, Australia',
            lat: -31.9457, lng: 115.8605,
            assignedTo: sarah._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(10),
        },

        // ── LOW / open ────────────────────────────────────────────────────
        {
            title: 'Welfare check — new referral, Fremantle',
            description: 'Referral received from community health nurse. Male, 42, recently released from prison, living in transitional accommodation. Initial contact visit to assess housing stability and link to employment services.',
            status: 'open',
            priority: 'low',
            type: 'welfare_check',
            region: 'Fremantle',
            address: '1 William Street, Fremantle WA 6160, Australia',
            lat: -32.0569, lng: 115.7439,
            assignedTo: marcus._id, createdBy: admin._id, workspaceId: wid,
            dueAt: daysFromNow(14),
            createdAt: daysAgo(12),
        },

        // ── CLOSED cases ──────────────────────────────────────────────────
        {
            title: 'Vehicle road rescue — Tonkin Highway, Forrestfield',
            description: 'Two-vehicle collision on Tonkin Highway northbound. Driver of sedan trapped by intrusion of firewall. Heavy rescue unit from High Wycombe attended. Patient extracted in 22 minutes, transported to Royal Perth.',
            status: 'closed',
            priority: 'critical',
            type: 'rescue',
            region: 'Forrestfield',
            address: 'Tonkin Highway, Forrestfield WA 6058, Australia',
            lat: -31.9721, lng: 116.0220,
            assignedTo: tom._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(14),
        },
        {
            title: 'Structure fire — commercial kitchen, Victoria Park',
            description: 'Chip fryer fire in a takeaway restaurant on Albany Highway escalated to full kitchen involvement. Suppressed by first crew on arrival. Health inspector notified, premises closed pending gas safety certificate.',
            status: 'closed',
            priority: 'high',
            type: 'fire',
            region: 'Victoria Park',
            address: '312 Albany Highway, Victoria Park WA 6100, Australia',
            lat: -31.9822, lng: 115.8958,
            assignedTo: sarah._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(18),
        },
        {
            title: 'Missing person located — Cottesloe Beach',
            description: 'Elderly female, 79, with dementia reported missing by residential care facility. Located within two hours by volunteers on Marine Parade, confused but uninjured. Returned to facility. Review of care protocols initiated.',
            status: 'closed',
            priority: 'high',
            type: 'missing_person',
            region: 'Cottesloe',
            address: 'Marine Parade, Cottesloe WA 6011, Australia',
            lat: -31.9946, lng: 115.7546,
            assignedTo: priya._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(20),
        },
        {
            title: 'Welfare check resolved — Rockingham',
            description: 'Neighbour concern for male, 55, living alone following relationship breakdown. Caseworker attended, client found safe. Connected with Lifeline and men\'s health support group. No further immediate risk identified.',
            status: 'closed',
            priority: 'low',
            type: 'welfare_check',
            region: 'Rockingham',
            address: '3 Dixon Road, Rockingham WA 6168, Australia',
            lat: -32.2780, lng: 115.7282,
            assignedTo: marcus._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(22),
        },
        {
            title: 'Medical assist — post-op recovery, Claremont',
            description: 'Female, 72, referred by GP following knee replacement surgery. Caseworker completed two home visits to assist with transport to physiotherapy and set up Meals on Wheels. Family now engaged, case handed to them.',
            status: 'closed',
            priority: 'low',
            type: 'medical',
            region: 'Claremont',
            address: '7 Bay View Terrace, Claremont WA 6010, Australia',
            lat: -31.9802, lng: 115.7827,
            assignedTo: sarah._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(25),
        },
        {
            title: 'Structural fire — residential, Bassendean',
            description: 'Roof fire in a 1960s weatherboard home caused by faulty chimney flue. Crews from Bassendean and Guildford contained fire to roof cavity. Owner displaced, Red Cross notified for emergency accommodation.',
            status: 'closed',
            priority: 'high',
            type: 'fire',
            region: 'Bassendean',
            address: '21 Old Perth Road, Bassendean WA 6054, Australia',
            lat: -31.9064, lng: 115.9450,
            assignedTo: tom._id, createdBy: admin._id, workspaceId: wid,
            createdAt: daysAgo(30),
        },
    ]);

    // --- Activities ---
    // Add realistic activity timelines for key cases
    type ActivityDoc = { caseId: mongoose.Types.ObjectId; authorId: mongoose.Types.ObjectId; note: string; type: string; workspaceId: mongoose.Types.ObjectId; createdAt: Date };
    const activities: ActivityDoc[] = [];

    // Subiaco fire (cases[0]) — open, critical
    activities.push(
        { caseId: cases[0]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(0) },
        { caseId: cases[0]._id, authorId: marcus._id, note: 'Two appliances on scene. Confirming persons-at-risk sweep in progress. Aerial requested.', type: 'note', workspaceId: wid, createdAt: daysAgo(0) },
    );

    // Serpentine grassfire (cases[1]) — open, critical
    activities.push(
        { caseId: cases[1]._id, authorId: admin._id, note: 'Case assigned to Sarah Chen. Air support authorised.', type: 'assignment', workspaceId: wid, createdAt: daysAgo(0) },
        { caseId: cases[1]._id, authorId: sarah._id, note: 'Fire front has shifted south-west following wind change. Evacuating two additional lots on Hoffman Road.', type: 'note', workspaceId: wid, createdAt: daysAgo(0) },
    );

    // Kings Park missing person (cases[2]) — open, critical
    activities.push(
        { caseId: cases[2]._id, authorId: admin._id, note: 'Search team briefed at 08:00. Police dog unit joining at 09:30.', type: 'note', workspaceId: wid, createdAt: daysAgo(1) },
        { caseId: cases[2]._id, authorId: priya._id, note: 'Western search quadrant cleared. Re-deploying to northern trail network. Helicopter thermal imaging requested.', type: 'note', workspaceId: wid, createdAt: daysAgo(0) },
    );

    // Kwinana hazmat (cases[3]) — open, critical
    activities.push(
        { caseId: cases[3]._id, authorId: admin._id, note: 'EPA and Department of Water notified. Level B PPE deployed.', type: 'note', workspaceId: wid, createdAt: daysAgo(0) },
        { caseId: cases[3]._id, authorId: tom._id, note: 'Perimeter secured. Three casualties evacuated to Fiona Stanley. Cleanup contractor ETA 90 minutes.', type: 'note', workspaceId: wid, createdAt: daysAgo(0) },
    );

    // Canning Vale roof collapse (cases[4]) — in_progress, critical
    activities.push(
        { caseId: cases[4]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(1) },
        { caseId: cases[4]._id, authorId: marcus._id, note: 'First casualty extricated at 14:25. Conscious and breathing. Second casualty still under debris — shoring in progress.', type: 'note', workspaceId: wid, createdAt: daysAgo(0) },
        { caseId: cases[4]._id, authorId: marcus._id, note: 'WorkSafe inspector on site. Building engineer has assessed remaining structure as stable for continued rescue operations.', type: 'note', workspaceId: wid, createdAt: daysAgo(0) },
    );

    // Scarborough missing teenager (cases[5]) — in_progress, critical
    activities.push(
        { caseId: cases[5]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(2) },
        { caseId: cases[5]._id, authorId: priya._id, note: 'Water police searching northern rip channel. Surf rescue IRB covering shallow water. Friends being interviewed by police on beach.', type: 'note', workspaceId: wid, createdAt: daysAgo(2) },
        { caseId: cases[5]._id, authorId: priya._id, note: 'Search suspended at nightfall. To resume at dawn with expanded search area including Trigg Beach to the north.', type: 'note', workspaceId: wid, createdAt: daysAgo(1) },
    );

    // Armadale welfare check (cases[6]) — open, high
    activities.push(
        { caseId: cases[6]._id, authorId: sarah._id, note: 'Initial phone attempt to neighbour for key. No answer. Will attend in person tomorrow morning with police.', type: 'note', workspaceId: wid, createdAt: daysAgo(2) },
    );

    // Balga child at risk (cases[7]) — open, high
    activities.push(
        { caseId: cases[7]._id, authorId: priya._id, note: 'DCP records reviewed. Previous case closed 18 months ago. Joint visit with Balga police arranged for Thursday 09:00.', type: 'note', workspaceId: wid, createdAt: daysAgo(3) },
    );

    // Joondalup cardiac (cases[10]) — in_progress, high
    activities.push(
        { caseId: cases[10]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(5) },
        { caseId: cases[10]._id, authorId: sarah._id, note: 'Patient stabilised and transferred to coronary care unit. Next of kin arrived at hospital. Follow-up welfare visit to family home scheduled for next week.', type: 'note', workspaceId: wid, createdAt: daysAgo(4) },
    );

    // Mandurah storm damage (cases[11]) — in_progress, high
    activities.push(
        { caseId: cases[11]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(3) },
        { caseId: cases[11]._id, authorId: tom._id, note: 'Couple safely extricated via rear exit. Minor lacerations treated on scene. Emergency accommodation arranged at ibis Mandurah for three nights.', type: 'note', workspaceId: wid, createdAt: daysAgo(2) },
        { caseId: cases[11]._id, authorId: tom._id, note: 'Council building inspector attended. Property deemed uninhabitable pending structural assessment. Owners liaising with insurer.', type: 'note', workspaceId: wid, createdAt: daysAgo(1) },
    );

    // Midvale welfare (cases[12]) — in_progress, high
    activities.push(
        { caseId: cases[12]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(6) },
        { caseId: cases[12]._id, authorId: priya._id, note: 'Emergency relief food hamper delivered. Referred to Anglicare financial counsellor. Reconnection of electricity arranged through hardship fund.', type: 'note', workspaceId: wid, createdAt: daysAgo(5) },
        { caseId: cases[12]._id, authorId: priya._id, note: 'School contacted — children to recommence attendance Monday. Mother engaged and cooperative.', type: 'note', workspaceId: wid, createdAt: daysAgo(3) },
    );

    // Northbridge welfare follow-up (cases[18]) — in_progress, medium
    activities.push(
        { caseId: cases[18]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(10) },
        { caseId: cases[18]._id, authorId: sarah._id, note: 'Second visit completed. All three children now enrolled at Highgate Primary. Food bank referral accepted. Father discharged from hospital, recuperating at home.', type: 'note', workspaceId: wid, createdAt: daysAgo(7) },
    );

    // Tonkin Highway rescue (closed) (cases[19])
    activities.push(
        { caseId: cases[19]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(14) },
        { caseId: cases[19]._id, authorId: tom._id, note: 'Patient extricated and transported to Royal Perth Trauma Centre. Incident report submitted to Fleet Operations.', type: 'note', workspaceId: wid, createdAt: daysAgo(14) },
        { caseId: cases[19]._id, authorId: admin._id, note: 'Status changed from in_progress to closed', type: 'status_change', workspaceId: wid, createdAt: daysAgo(13) },
    );

    // Victoria Park fire (closed) (cases[20])
    activities.push(
        { caseId: cases[20]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(18) },
        { caseId: cases[20]._id, authorId: sarah._id, note: 'Fire suppressed. Health and safety officer contacted. Premises secured with boarding.', type: 'note', workspaceId: wid, createdAt: daysAgo(18) },
        { caseId: cases[20]._id, authorId: admin._id, note: 'Status changed from in_progress to closed', type: 'status_change', workspaceId: wid, createdAt: daysAgo(17) },
    );

    // Cottesloe missing person (closed) (cases[21])
    activities.push(
        { caseId: cases[21]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(20) },
        { caseId: cases[21]._id, authorId: priya._id, note: 'Subject located on Marine Parade by volunteer patrol. Returned safely to Cottesloe aged care. Facility management notified of absconding risk.', type: 'note', workspaceId: wid, createdAt: daysAgo(20) },
        { caseId: cases[21]._id, authorId: admin._id, note: 'Status changed from in_progress to closed', type: 'status_change', workspaceId: wid, createdAt: daysAgo(20) },
    );

    // Rockingham welfare (closed) (cases[22])
    activities.push(
        { caseId: cases[22]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(22) },
        { caseId: cases[22]._id, authorId: marcus._id, note: 'Client visited. In good health. Linked to men\'s support group meeting Thursdays at Rockingham Community Centre.', type: 'note', workspaceId: wid, createdAt: daysAgo(22) },
        { caseId: cases[22]._id, authorId: admin._id, note: 'Status changed from in_progress to closed', type: 'status_change', workspaceId: wid, createdAt: daysAgo(21) },
    );

    // Bassendean fire (closed) (cases[24])
    activities.push(
        { caseId: cases[24]._id, authorId: admin._id, note: 'Status changed from open to in_progress', type: 'status_change', workspaceId: wid, createdAt: daysAgo(30) },
        { caseId: cases[24]._id, authorId: tom._id, note: 'Fire contained to roof space. Owner contacted Red Cross independently. Salvage crews removed personal items before rain forecast.', type: 'note', workspaceId: wid, createdAt: daysAgo(29) },
        { caseId: cases[24]._id, authorId: admin._id, note: 'Status changed from in_progress to closed', type: 'status_change', workspaceId: wid, createdAt: daysAgo(28) },
    );

    await Activity.insertMany(activities);

    // --- Alerts ---
    await Alert.insertMany([
        {
            message: 'Total Fire Ban in effect for Perth Metro and Hills districts. All burning prohibited.',
            severity: 'critical',
            region: 'Perth Metro',
            isActive: true,
            createdBy: admin._id,
            workspaceId: wid,
        },
        {
            message: 'Hazmat incident on Kwinana Beach Road. Avoid Rockingham Road interchange and surrounds.',
            severity: 'high',
            region: 'Kwinana',
            lat: -32.2390,
            lng: 115.7741,
            isActive: true,
            createdBy: admin._id,
            workspaceId: wid,
        },
        {
            message: 'Search operation underway at Kings Park. Public asked to stay on marked trails and report any sightings to 000.',
            severity: 'high',
            region: 'Kings Park',
            lat: -31.9601,
            lng: 115.8329,
            isActive: true,
            createdBy: admin._id,
            workspaceId: wid,
        },
        {
            message: 'Severe storm warning for Perth coastal strip. Gusts to 90 km/h expected this evening.',
            severity: 'medium',
            region: 'Perth Coastal',
            isActive: true,
            createdBy: admin._id,
            workspaceId: wid,
        },
    ]);

    console.log('\nSeed complete.');
    console.log('─────────────────────────────────────────');
    console.log('Workspace : DFES Perth Metro');
    console.log('Admin     : admin@caselink.test / password123');
    console.log('Caseworkers:');
    console.log('  sarah@caselink.test  / password123  (Sarah Chen)');
    console.log('  marcus@caselink.test / password123  (Marcus Webb)');
    console.log('  priya@caselink.test  / password123  (Priya Nair)');
    console.log('  tom@caselink.test    / password123  (Tom Gallagher)');
    console.log(`Cases     : ${cases.length} total`);
    console.log(`Activities: ${activities.length} entries`);
    console.log(`Alerts    : 4 active`);
    console.log('─────────────────────────────────────────');

    await mongoose.disconnect();
}

seed().catch((err) => {
    console.error(err);
    process.exit(1);
});
