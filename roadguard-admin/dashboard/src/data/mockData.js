export const ISSUE_CATEGORIES = [
  "Pothole",
  "Longitudinal Crack",
  "Transverse Crack",
  "Alligator Crack",
  "Accident",
  "Waterlogging / Flood",
  "Fallen Tree",
  "Road Debris",
  "Construction Obstruction",
  "Road Blockage",
  "Broken Traffic Signal",
  "Vehicle Breakdown",
  "Other"
];

export const DESIGNATIONS = [
  "Road Inspector",
  "Field Engineer",
  "Traffic Officer",
  "Supervisor",
  "Maintenance Worker",
  "Emergency Response Officer"
];

export const INITIAL_EMPLOYEES = [
  {
    id: "EMP-101",
    name: "Rajesh Sharma",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    email: "rajesh.sharma@amc.gov.in",
    designation: "Field Engineer",
    status: "Active",
    assignedTasks: 2,
    completedTasks: 14,
    registrationDate: "2025-11-12",
    phone: "+91 98765 43210"
  },
  {
    id: "EMP-102",
    name: "Ananya Rao",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    email: "ananya.rao@amc.gov.in",
    designation: "Road Inspector",
    status: "Active",
    assignedTasks: 1,
    completedTasks: 22,
    registrationDate: "2025-08-04",
    phone: "+91 98123 45678"
  },
  {
    id: "EMP-103",
    name: "Vikram Kumar",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    email: "vikram.k@amc.gov.in",
    designation: "Traffic Officer",
    status: "Active",
    assignedTasks: 3,
    completedTasks: 19,
    registrationDate: "2026-01-15",
    phone: "+91 97654 32109"
  },
  {
    id: "EMP-104",
    name: "Suresh Verma",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    email: "suresh.verma@amc.gov.in",
    designation: "Maintenance Worker",
    status: "Active",
    assignedTasks: 2,
    completedTasks: 31,
    registrationDate: "2025-06-20",
    phone: "+91 96543 21098"
  },
  {
    id: "EMP-105",
    name: "Divya Patel",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    email: "divya.patel@amc.gov.in",
    designation: "Emergency Response Officer",
    status: "Active",
    assignedTasks: 1,
    completedTasks: 18,
    registrationDate: "2026-02-01",
    phone: "+91 95432 10987"
  },
  {
    id: "EMP-106",
    name: "Manoj Reddy",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    email: "manoj.reddy@amc.gov.in",
    designation: "Supervisor",
    status: "Active",
    assignedTasks: 0,
    completedTasks: 45,
    registrationDate: "2025-03-10",
    phone: "+91 94321 09876"
  },
  {
    id: "EMP-107",
    name: "Priya Nair",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80",
    email: "priya.nair@amc.gov.in",
    designation: "Road Inspector",
    status: "Pending Approval",
    assignedTasks: 0,
    completedTasks: 0,
    registrationDate: "2026-10-08",
    phone: "+91 93210 98765"
  },
  {
    id: "EMP-108",
    name: "K. Satyanarayana",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    email: "k.satya@amc.gov.in",
    designation: "Field Engineer",
    status: "Deactivated",
    assignedTasks: 0,
    completedTasks: 8,
    registrationDate: "2025-09-18",
    phone: "+91 92109 87654"
  }
];

export const INITIAL_ISSUES = [
  {
    id: "RG-2026-8941",
    category: "Pothole",
    title: "Deep Pothole near VIT-AP Gate 2",
    description: "Dangerous 40cm wide pothole on main carriageway creating immediate hazard for two-wheelers and heavy transit vehicles near VIT-AP campus.",
    locationName: "VIT-AP Main Road, Gate 2, Ainavolu",
    latitude: 16.4975,
    longitude: 80.4998,
    reportCount: 18,
    priority: "Critical",
    priorityScore: 94,
    status: "In Progress",
    reportedDate: "2026-10-08 08:30 AM",
    lastUpdated: "2026-10-10 11:15 AM",
    assignedEmployeeId: "EMP-101",
    assignedEmployeeName: "Rajesh Sharma",
    photos: [
      "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Admin", text: "Priority elevated to Critical after 18 duplicate citizen reports in 24 hrs.", timestamp: "2026-10-08 10:00 AM" },
      { id: 2, author: "Rajesh Sharma", text: "Site inspection complete. Asphalt cold mix patch deployment scheduled.", timestamp: "2026-10-09 14:20 PM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-08 08:30 AM", status: "Unassigned", actor: "Citizen App Ingestion", note: "Report created from mobile app" },
      { timestamp: "2026-10-08 10:05 AM", status: "Assigned", actor: "Admin Manoj Reddy", note: "Assigned to Field Engineer Rajesh Sharma" },
      { timestamp: "2026-10-09 09:00 AM", status: "In Progress", actor: "Rajesh Sharma", note: "Barricades erected, repair team dispatched" }
    ]
  },
  {
    id: "RG-2026-8942",
    category: "Waterlogging / Flood",
    title: "Severe Drainage Overflow near Inavolu Junction",
    description: "Monsoon runoff overflow blocking both lanes of Seed Access Road. Water depth approx 25cm. Traffic moving slowly.",
    locationName: "Seed Access Road, Inavolu Junction",
    latitude: 16.5052,
    longitude: 80.5124,
    reportCount: 14,
    priority: "Critical",
    priorityScore: 89,
    status: "Assigned",
    reportedDate: "2026-10-07 14:45 PM",
    lastUpdated: "2026-10-10 09:30 AM",
    assignedEmployeeId: "EMP-105",
    assignedEmployeeName: "Divya Patel",
    photos: [
      "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Admin", text: "Suction pump team requested from Zone 3 Depot.", timestamp: "2026-10-07 16:00 PM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-07 14:45 PM", status: "Unassigned", actor: "System Alert", note: "Multi-citizen reports logged" },
      { timestamp: "2026-10-07 15:30 PM", status: "Assigned", actor: "Admin", note: "Assigned to Emergency Officer Divya Patel" }
    ]
  },
  {
    id: "RG-2026-8943",
    category: "Broken Traffic Signal",
    title: "Signal Controller Failure at Secretariat Circle",
    description: "Traffic lights flashing red in all four directions causing congestion during peak office hours.",
    locationName: "Secretariat Main Circle, Velagapudi",
    latitude: 16.5188,
    longitude: 80.5281,
    reportCount: 26,
    priority: "High",
    priorityScore: 78,
    status: "In Progress",
    reportedDate: "2026-10-09 17:10 PM",
    lastUpdated: "2026-10-10 08:20 AM",
    assignedEmployeeId: "EMP-103",
    assignedEmployeeName: "Vikram Kumar",
    photos: [
      "https://images.unsplash.com/photo-1508873696983-2df515122519?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Vikram Kumar", text: "Manual traffic control active. Signal relay card replacement in progress.", timestamp: "2026-10-10 08:30 AM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-09 17:10 PM", status: "Unassigned", actor: "Citizen App", note: "Signal fault reported" },
      { timestamp: "2026-10-09 17:30 PM", status: "Assigned", actor: "Admin", note: "Assigned to Traffic Officer Vikram Kumar" },
      { timestamp: "2026-10-09 18:00 PM", status: "In Progress", actor: "Vikram Kumar", note: "On-site manual control initiated" }
    ]
  },
  {
    id: "RG-2026-8944",
    category: "Accident",
    title: "Two-Vehicle Collision near Neerukonda Flyover",
    description: "Minor collision blocking right lane. Emergency vehicle dispatched, towing required for debris clearing.",
    locationName: "Neerukonda Bypass Road",
    latitude: 16.4880,
    longitude: 80.4850,
    reportCount: 9,
    priority: "High",
    priorityScore: 82,
    status: "Assigned",
    reportedDate: "2026-10-10 10:15 AM",
    lastUpdated: "2026-10-10 10:45 AM",
    assignedEmployeeId: "EMP-105",
    assignedEmployeeName: "Divya Patel",
    photos: [
      "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [],
    taskHistory: [
      { timestamp: "2026-10-10 10:15 AM", status: "Unassigned", actor: "SOS Dispatch", note: "Accident notification received" },
      { timestamp: "2026-10-10 10:25 AM", status: "Assigned", actor: "Admin", note: "Assigned to Divya Patel" }
    ]
  },
  {
    id: "RG-2026-8945",
    category: "Alligator Crack",
    title: "Structural Asphalt Failure near Rayapudi Market",
    description: "Extensive cracking over 15 meter stretch. Risk of rapid pothole formation during rain.",
    locationName: "Rayapudi Main Road, Shop #45",
    latitude: 16.5260,
    longitude: 80.5050,
    reportCount: 5,
    priority: "Medium",
    priorityScore: 61,
    status: "Unassigned",
    reportedDate: "2026-10-06 11:00 AM",
    lastUpdated: "2026-10-06 11:00 AM",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    photos: [
      "https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Admin", text: "Pending allocation during weekly resurfacing cycle.", timestamp: "2026-10-07 09:00 AM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-06 11:00 AM", status: "Unassigned", actor: "Inspector App", note: "Logged by Ananya Rao" }
    ]
  },
  {
    id: "RG-2026-8946",
    category: "Fallen Tree",
    title: "Banyan Tree Branch Obstruction on Thullur Corridor",
    description: "Heavy storm damage caused branch to block left lane towards Thullur Bus Stand.",
    locationName: "Thullur Main Corridor, Km 4.2",
    latitude: 16.5340,
    longitude: 80.4720,
    reportCount: 11,
    priority: "High",
    priorityScore: 76,
    status: "In Progress",
    reportedDate: "2026-10-09 21:00 PM",
    lastUpdated: "2026-10-10 07:15 AM",
    assignedEmployeeId: "EMP-104",
    assignedEmployeeName: "Suresh Verma",
    photos: [
      "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Suresh Verma", text: "Chainsaw crew on site. 60% branch cleared.", timestamp: "2026-10-10 07:30 AM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-09 21:00 PM", status: "Unassigned", actor: "Citizen App", note: "Reported" },
      { timestamp: "2026-10-09 21:30 PM", status: "Assigned", actor: "Admin", note: "Assigned to Suresh Verma" },
      { timestamp: "2026-10-10 06:30 AM", status: "In Progress", actor: "Suresh Verma", note: "Tree clearing commenced" }
    ]
  },
  {
    id: "RG-2026-8947",
    category: "Road Debris",
    title: "Gravel Spillage near Uddandarayunipalem Bend",
    description: "Loose construction gravel dumped across 30 meters causing skid risks for bikes.",
    locationName: "Uddandarayunipalem River Road",
    latitude: 16.5410,
    longitude: 80.5180,
    reportCount: 4,
    priority: "Medium",
    priorityScore: 52,
    status: "Assigned",
    reportedDate: "2026-10-10 06:45 AM",
    lastUpdated: "2026-10-10 08:00 AM",
    assignedEmployeeId: "EMP-104",
    assignedEmployeeName: "Suresh Verma",
    photos: [
      "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [],
    taskHistory: [
      { timestamp: "2026-10-10 06:45 AM", status: "Unassigned", actor: "Citizen App", note: "Reported" },
      { timestamp: "2026-10-10 08:00 AM", status: "Assigned", actor: "Admin", note: "Assigned to Suresh Verma" }
    ]
  },
  {
    id: "RG-2026-8948",
    category: "Construction Obstruction",
    title: "Unmarked Trenching near Amaravati High Court Gate",
    description: "Utility contractor left open cabling trench without warning signs or flashing beacons.",
    locationName: "High Court Road, Nelapadu",
    latitude: 16.5110,
    longitude: 80.5380,
    reportCount: 8,
    priority: "High",
    priorityScore: 79,
    status: "Unassigned",
    reportedDate: "2026-10-09 15:30 PM",
    lastUpdated: "2026-10-09 15:30 PM",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    photos: [
      "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Admin", text: "Notice issued to telecom contractor.", timestamp: "2026-10-10 09:10 AM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-09 15:30 PM", status: "Unassigned", actor: "Citizen App", note: "Reported" }
    ]
  },
  {
    id: "RG-2026-8949",
    category: "Vehicle Breakdown",
    title: "Heavy Truck Axle Breakdown on Vijayawada Highway Link",
    description: "Loaded 12-wheeler truck stranded on central lane causing 2km bottleneck.",
    locationName: "NH-16 Link Road, Mangalagiri Junction",
    latitude: 16.4420,
    longitude: 80.5620,
    reportCount: 31,
    priority: "Critical",
    priorityScore: 96,
    status: "In Progress",
    reportedDate: "2026-10-10 11:00 AM",
    lastUpdated: "2026-10-10 11:30 AM",
    assignedEmployeeId: "EMP-103",
    assignedEmployeeName: "Vikram Kumar",
    photos: [
      "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Vikram Kumar", text: "Heavy crane tow truck en route from Vijayawada Depot.", timestamp: "2026-10-10 11:35 AM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-10 11:00 AM", status: "Unassigned", actor: "Traffic Hotline", note: "Breakdown logged" },
      { timestamp: "2026-10-10 11:10 AM", status: "Assigned", actor: "Admin", note: "Assigned to Vikram Kumar" },
      { timestamp: "2026-10-10 11:30 AM", status: "In Progress", actor: "Vikram Kumar", note: "Diversions set up" }
    ]
  },
  {
    id: "RG-2026-8950",
    category: "Transverse Crack",
    title: "Thermal Expansion Joint Separation on Krishna Bridge Approach",
    description: "Gap widened to 5cm across full road width. Bouncing vehicles at high speeds.",
    locationName: "Prakasam Barrage Approach Road",
    latitude: 16.5080,
    longitude: 80.6120,
    reportCount: 7,
    priority: "Medium",
    priorityScore: 58,
    status: "Assigned",
    reportedDate: "2026-10-08 14:00 PM",
    lastUpdated: "2026-10-09 10:00 AM",
    assignedEmployeeId: "EMP-101",
    assignedEmployeeName: "Rajesh Sharma",
    photos: [
      "https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [],
    taskHistory: [
      { timestamp: "2026-10-08 14:00 PM", status: "Unassigned", actor: "Citizen App", note: "Reported" },
      { timestamp: "2026-10-09 10:00 AM", status: "Assigned", actor: "Admin", note: "Assigned to Rajesh Sharma" }
    ]
  },
  {
    id: "RG-2026-8951",
    category: "Pothole",
    title: "Cluster Potholes on Seed Access Road Km 12",
    description: "Multiple connected potholes following recent monsoon showers near NGR Township.",
    locationName: "Seed Access Road, Km 12",
    latitude: 16.5010,
    longitude: 80.4910,
    reportCount: 12,
    priority: "High",
    priorityScore: 81,
    status: "Unassigned",
    reportedDate: "2026-10-09 19:20 PM",
    lastUpdated: "2026-10-09 19:20 PM",
    assignedEmployeeId: null,
    assignedEmployeeName: null,
    photos: [
      "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [],
    taskHistory: [
      { timestamp: "2026-10-09 19:20 PM", status: "Unassigned", actor: "Citizen App", note: "Reported" }
    ]
  },
  {
    id: "RG-2026-8952",
    category: "Pothole",
    title: "Pothole Repaired at VIT-AP North Campus Road",
    description: "Pothole filled with dense bituminized gravel and steam rolled flat.",
    locationName: "VIT-AP North Campus Inner Road",
    latitude: 16.5020,
    longitude: 80.5030,
    reportCount: 15,
    priority: "High",
    priorityScore: 75,
    status: "Resolved",
    reportedDate: "2026-10-05 10:00 AM",
    lastUpdated: "2026-10-09 16:30 PM",
    assignedEmployeeId: "EMP-102",
    assignedEmployeeName: "Ananya Rao",
    resolutionDate: "2026-10-09 16:30 PM",
    resolutionDuration: "4 hours 20 mins",
    resolutionNotes: "Resurfaced with 50mm BC asphalt mix. Quality test passed.",
    photos: [
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [
      { id: 1, author: "Ananya Rao", text: "Patch inspected. Quality verification code RG-PASS-99.", timestamp: "2026-10-09 16:35 PM" }
    ],
    taskHistory: [
      { timestamp: "2026-10-05 10:00 AM", status: "Unassigned", actor: "Citizen App", note: "Reported" },
      { timestamp: "2026-10-06 09:00 AM", status: "Assigned", actor: "Admin", note: "Assigned to Ananya Rao" },
      { timestamp: "2026-10-09 12:00 PM", status: "In Progress", actor: "Ananya Rao", note: "Work started" },
      { timestamp: "2026-10-09 16:30 PM", status: "Resolved", actor: "Ananya Rao", note: "Work completed & certified" }
    ]
  },
  {
    id: "RG-2026-8953",
    category: "Waterlogging / Flood",
    title: "Storm Drain Clearance at Undavalli Center",
    description: "Culvert unblocked using hydro-jetting truck.",
    locationName: "Undavalli Cave Road Junction",
    latitude: 16.4950,
    longitude: 80.5850,
    reportCount: 22,
    priority: "Critical",
    priorityScore: 91,
    status: "Resolved",
    reportedDate: "2026-10-04 07:15 AM",
    lastUpdated: "2026-10-07 18:00 PM",
    assignedEmployeeId: "EMP-104",
    assignedEmployeeName: "Suresh Verma",
    resolutionDate: "2026-10-07 18:00 PM",
    resolutionDuration: "12 hours",
    resolutionNotes: "Debris and silt completely dredged from culvert. Normal drainage restored.",
    photos: [
      "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [],
    taskHistory: [
      { timestamp: "2026-10-04 07:15 AM", status: "Unassigned", actor: "Citizen App", note: "Reported" },
      { timestamp: "2026-10-04 08:00 AM", status: "Assigned", actor: "Admin", note: "Assigned to Suresh Verma" },
      { timestamp: "2026-10-07 18:00 PM", status: "Resolved", actor: "Suresh Verma", note: "Drainage cleared" }
    ]
  },
  {
    id: "RG-2026-8954",
    category: "Broken Traffic Signal",
    title: "Pedestrian Crossing Signal Repair at Amaravati Bus Stand",
    description: "LED module replaced and timer recalibrated.",
    locationName: "Amaravati Central Bus Terminus",
    latitude: 16.5750,
    longitude: 80.3550,
    reportCount: 11,
    priority: "Medium",
    priorityScore: 65,
    status: "Resolved",
    reportedDate: "2026-10-06 09:30 AM",
    lastUpdated: "2026-10-08 11:45 AM",
    assignedEmployeeId: "EMP-103",
    assignedEmployeeName: "Vikram Kumar",
    resolutionDate: "2026-10-08 11:45 AM",
    resolutionDuration: "2 hours 15 mins",
    resolutionNotes: "Replaced main logic board and LED display matrix.",
    photos: [
      "https://images.unsplash.com/photo-1508873696983-2df515122519?w=800&auto=format&fit=crop&q=80"
    ],
    adminNotes: [],
    taskHistory: [
      { timestamp: "2026-10-06 09:30 AM", status: "Unassigned", actor: "Citizen App", note: "Reported" },
      { timestamp: "2026-10-08 11:45 AM", status: "Resolved", actor: "Vikram Kumar", note: "Repaired" }
    ]
  }
];

export const INITIAL_TASKS = [
  {
    id: "TSK-4001",
    title: "Deploy Cold Mix Asphalt at VIT-AP Gate 2",
    linkedIssueId: "RG-2026-8941",
    linkedIssueCategory: "Pothole",
    assignedEmployeeId: "EMP-101",
    assignedEmployeeName: "Rajesh Sharma",
    priority: "Critical",
    dueDate: "2026-10-11",
    status: "In Progress",
    createdDate: "2026-10-08",
    description: "Erect warning cones, compact sub-base, apply bituminous cold mix, and level with road roller."
  },
  {
    id: "TSK-4002",
    title: "Operate Water Pump at Inavolu Drain Overflow",
    linkedIssueId: "RG-2026-8942",
    linkedIssueCategory: "Waterlogging / Flood",
    assignedEmployeeId: "EMP-105",
    assignedEmployeeName: "Divya Patel",
    priority: "Critical",
    dueDate: "2026-10-10",
    status: "Assigned",
    createdDate: "2026-10-07",
    description: "Set up 500 GPM high-capacity diesel pump to divert standing water into side canal."
  },
  {
    id: "TSK-4003",
    title: "Replace Control Relay at Secretariat Circle Signal",
    linkedIssueId: "RG-2026-8943",
    linkedIssueCategory: "Broken Traffic Signal",
    assignedEmployeeId: "EMP-103",
    assignedEmployeeName: "Vikram Kumar",
    priority: "High",
    dueDate: "2026-10-10",
    status: "In Progress",
    createdDate: "2026-10-09",
    description: "Install replacement relay PCB board unit #88-B and reset master controller software."
  },
  {
    id: "TSK-4004",
    title: "Clear Fallen Banyan Branch on Thullur Corridor",
    linkedIssueId: "RG-2026-8946",
    linkedIssueCategory: "Fallen Tree",
    assignedEmployeeId: "EMP-104",
    assignedEmployeeName: "Suresh Verma",
    priority: "High",
    dueDate: "2026-10-10",
    status: "In Progress",
    createdDate: "2026-10-09",
    description: "Cut large timber sections into transportable logs and haul away using flatbed truck."
  },
  {
    id: "TSK-4005",
    title: "Sweep Gravel Spillage at Uddandarayunipalem",
    linkedIssueId: "RG-2026-8947",
    linkedIssueCategory: "Road Debris",
    assignedEmployeeId: "EMP-104",
    assignedEmployeeName: "Suresh Verma",
    priority: "Medium",
    dueDate: "2026-10-12",
    status: "Assigned",
    createdDate: "2026-10-10",
    description: "Mechanical sweeper run across 30 meter road segment."
  },
  {
    id: "TSK-4006",
    title: "Tow Stranded Truck on Vijayawada Link Road",
    linkedIssueId: "RG-2026-8949",
    linkedIssueCategory: "Vehicle Breakdown",
    assignedEmployeeId: "EMP-103",
    assignedEmployeeName: "Vikram Kumar",
    priority: "Critical",
    dueDate: "2026-10-10",
    status: "In Progress",
    createdDate: "2026-10-10",
    description: "Coordinate with heavy rescue unit to lift rear axle and tow vehicle to nearest layby."
  },
  {
    id: "TSK-4007",
    title: "Inspect Krishna Bridge Expansion Joint Gap",
    linkedIssueId: "RG-2026-8950",
    linkedIssueCategory: "Transverse Crack",
    assignedEmployeeId: "EMP-101",
    assignedEmployeeName: "Rajesh Sharma",
    priority: "Medium",
    dueDate: "2026-10-09",
    status: "Assigned",
    createdDate: "2026-10-08",
    description: "Measure bridge expansion movement and install elastomeric joint seal."
  },
  {
    id: "TSK-4008",
    title: "Complete Patch Inspection at North Campus",
    linkedIssueId: "RG-2026-8952",
    linkedIssueCategory: "Pothole",
    assignedEmployeeId: "EMP-102",
    assignedEmployeeName: "Ananya Rao",
    priority: "High",
    dueDate: "2026-10-09",
    status: "Resolved",
    createdDate: "2026-10-06",
    description: "Verify surface smoothness and take final post-repair photo documentation."
  }
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: "NTF-901",
    title: "Critical Pothole Alert",
    message: "Issue RG-2026-8941 near VIT-AP Gate 2 received 18 citizen reports in under 24 hours.",
    type: "critical",
    timestamp: "10 mins ago",
    read: false,
    link: "/admin/issues?id=RG-2026-8941"
  },
  {
    id: "NTF-902",
    title: "Task Overdue Warning",
    message: "Task TSK-4007 (Inspect Krishna Bridge Joint) has exceeded its scheduled completion window.",
    type: "warning",
    timestamp: "1 hour ago",
    read: false,
    link: "/admin/tasks"
  },
  {
    id: "NTF-903",
    title: "New Employee Registration",
    message: "Priya Nair registered as Road Inspector. Approval required.",
    type: "info",
    timestamp: "3 hours ago",
    read: false,
    link: "/admin/employees"
  },
  {
    id: "NTF-904",
    title: "Issue Unattended > 48 Hours",
    message: "Issue RG-2026-8945 (Alligator Crack, Rayapudi) has remained unassigned for over 48 hours.",
    type: "warning",
    timestamp: "5 hours ago",
    read: false,
    link: "/admin/issues?id=RG-2026-8945"
  },
  {
    id: "NTF-905",
    title: "Issue Successfully Resolved",
    message: "Ananya Rao marked RG-2026-8952 (VIT-AP North Campus Pothole) as Resolved.",
    type: "success",
    timestamp: "Yesterday",
    read: true,
    link: "/admin/resolved"
  },
  {
    id: "NTF-906",
    title: "AI Analysis Model Notice",
    message: "Road Vision AI inference service operates in local offline demo mode.",
    type: "system",
    timestamp: "2 days ago",
    read: true,
    link: "/admin/dashboard"
  }
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: "AUD-7001",
    timestamp: "2026-10-10 11:30 AM",
    actor: "Vikram Kumar",
    eventType: "STATUS_CHANGE",
    targetEntity: "RG-2026-8949",
    description: "Changed issue status from Assigned to In Progress",
    result: "SUCCESS"
  },
  {
    id: "AUD-7002",
    timestamp: "2026-10-10 10:25 AM",
    actor: "Admin (Manoj Reddy)",
    eventType: "TASK_ASSIGNMENT",
    targetEntity: "TSK-4006",
    description: "Assigned vehicle towing task to Emergency Officer Divya Patel",
    result: "SUCCESS"
  },
  {
    id: "AUD-7003",
    timestamp: "2026-10-10 09:10 AM",
    actor: "Admin (Manoj Reddy)",
    eventType: "ADMIN_NOTE_ADDED",
    targetEntity: "RG-2026-8948",
    description: "Added warning note regarding telecom contractor trenching",
    result: "SUCCESS"
  },
  {
    id: "AUD-7004",
    timestamp: "2026-10-09 16:30 PM",
    actor: "Ananya Rao",
    eventType: "ISSUE_RESOLVED",
    targetEntity: "RG-2026-8952",
    description: "Marked pothole issue at VIT-AP North Campus as Resolved with pass code RG-PASS-99",
    result: "SUCCESS"
  },
  {
    id: "AUD-7005",
    timestamp: "2026-10-08 10:05 AM",
    actor: "Admin (Manoj Reddy)",
    eventType: "TASK_CREATED",
    targetEntity: "TSK-4001",
    description: "Created cold mix asphalt task for RG-2026-8941",
    result: "SUCCESS"
  },
  {
    id: "AUD-7006",
    timestamp: "2026-10-08 09:00 AM",
    actor: "Priya Nair",
    eventType: "EMPLOYEE_REGISTER",
    targetEntity: "EMP-107",
    description: "Submitted new employee registration for Road Inspector role",
    result: "PENDING"
  }
];

export const INITIAL_SETTINGS = {
  orgProfile: {
    name: "Amaravati Municipal Corporation - Traffic & Roads Wing",
    domain: "amc.gov.in",
    email: "command.center@amc.gov.in",
    contactPhone: "+91 (0863) 234-5678",
    address: "Command & Control Centre, 3rd Floor, AMC Administrative Towers, Velagapudi, Amaravati, AP 522503",
    logoUrl: "/shield-logo.svg"
  },
  priorityRules: {
    criticalScoreThreshold: 85,
    highScoreThreshold: 70,
    mediumScoreThreshold: 45,
    duplicateRadiusMeters: 50,
    unattendedWarningHours: 48
  },
  notificationPreferences: {
    criticalAlertsEmail: true,
    overdueTasksSms: true,
    employeeRegistrationsWeb: true,
    dailyResolutionDigest: true
  },
  designationPermissions: [
    { role: "Supervisor", viewAll: true, assignTasks: true, approveUsers: true, editSettings: true, deleteData: false },
    { role: "Field Engineer", viewAll: true, assignTasks: true, approveUsers: false, editSettings: false, deleteData: false },
    { role: "Road Inspector", viewAll: true, assignTasks: false, approveUsers: false, editSettings: false, deleteData: false },
    { role: "Traffic Officer", viewAll: true, assignTasks: true, approveUsers: false, editSettings: false, deleteData: false },
    { role: "Maintenance Worker", viewAll: true, assignTasks: false, approveUsers: false, editSettings: false, deleteData: false },
    { role: "Emergency Response Officer", viewAll: true, assignTasks: true, approveUsers: false, editSettings: false, deleteData: false }
  ],
  profileAppearance: {
    adminName: "Manoj Reddy",
    adminDesignation: "Chief Municipal Traffic Supervisor",
    adminEmail: "manoj.reddy@amc.gov.in",
    theme: "light",
    sidebarCollapsedByDefault: false
  }
};
