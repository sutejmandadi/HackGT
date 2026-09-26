export type CompetencyKey = "leadership" | "teamwork" | "problem_solving" | "failure" | "ambiguity";

export interface BehavioralQuestion {
  id: string;
  category: CompetencyKey;
  prompt: string;
  coachTip: string;
  starFocus: string;
}

export interface CompetencyMeta {
  key: CompetencyKey;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

export const COMPETENCY_METAS: Record<CompetencyKey, CompetencyMeta> = {
  leadership: {
    key: "leadership",
    label: "Leadership & Initiative",
    shortLabel: "Leadership",
    color: "#a78bfa", // violet
    description: "Proactive ownership, mentoring, setting vision, rallying peers, and driving ambitious outcomes.",
  },
  teamwork: {
    key: "teamwork",
    label: "Teamwork & Conflict Resolution",
    shortLabel: "Teamwork",
    color: "#4de1ff", // accent cyan
    description: "Collaboration across functions, healthy conflict resolution, empathy, and disagree-and-commit maturity.",
  },
  problem_solving: {
    key: "problem_solving",
    label: "Problem Solving & Technical Execution",
    shortLabel: "Problem Solving",
    color: "#60a5fa", // blue
    description: "Root cause diagnosis, complex debugging, system simplification, and pragmatic technical trade-offs.",
  },
  failure: {
    key: "failure",
    label: "Handling Failure, Mistakes & Adaptability",
    shortLabel: "Resilience",
    color: "#f0cb84", // warning gold
    description: "Owning mistakes without defensiveness, learning from missed milestones, and navigating setbacks.",
  },
  ambiguity: {
    key: "ambiguity",
    label: "Ambiguity, Prioritization & Decision-Making",
    shortLabel: "Ambiguity",
    color: "#8addaf", // success green
    description: "Navigating vague requirements, high-stakes decisions without clear data, and balancing urgent trade-offs.",
  },
};

export const BEHAVIORAL_QUESTIONS: BehavioralQuestion[] = [
  // 1. Leadership & Initiative (10 questions)
  {
    id: "lead-1",
    category: "leadership",
    prompt: "Tell me about a time you took ownership of a project outside your defined scope.",
    coachTip: "Highlight self-direction. Explain how you recognized an unowned gap, took initiative without waiting for permission, and created lasting value.",
    starFocus: "Action & Initiative",
  },
  {
    id: "lead-2",
    category: "leadership",
    prompt: "Describe a situation where you noticed an inefficiency and took the initiative to fix it.",
    coachTip: "Quantify the inefficiency before and after. Focus on how you identified the root friction and brought teammates along with the change.",
    starFocus: "Task & Measurable Result",
  },
  {
    id: "lead-3",
    category: "leadership",
    prompt: "Tell me about a time you had to step up and lead a team unexpectedly.",
    coachTip: "Show composure in sudden leadership vacuums. Describe how you stabilized the team, clarified immediate priorities, and delegated clearly.",
    starFocus: "Action & Leadership",
  },
  {
    id: "lead-4",
    category: "leadership",
    prompt: "Describe an instance where you mentored or helped unblock a colleague or peer.",
    coachTip: "Focus on empowering the other person rather than just giving the answer. Highlight how your coaching built long-term autonomy.",
    starFocus: "Action & Mentorship",
  },
  {
    id: "lead-5",
    category: "leadership",
    prompt: "Give an example of a time you rallied a team behind a vision they were initially skeptical of.",
    coachTip: "Explain how you addressed doubts with proof-of-concepts or data, listened to concerns, and transformed skepticism into shared commitment.",
    starFocus: "Action & Influence",
  },
  {
    id: "lead-6",
    category: "leadership",
    prompt: "Tell me about a time you set an ambitious goal and drove the process to achieve it.",
    coachTip: "State the ambitious baseline and target clearly. Detail the structured milestones, cadence of check-ins, and execution discipline.",
    starFocus: "Task & Result",
  },
  {
    id: "lead-7",
    category: "leadership",
    prompt: "Describe a time you went above and beyond what was expected on an assignment.",
    coachTip: "Distinguish between overworking and high-leverage initiative (e.g., adding automated testing, creating reusable tooling, or writing docs).",
    starFocus: "Action & Added Value",
  },
  {
    id: "lead-8",
    category: "leadership",
    prompt: "Tell me about a time you had to make short-term sacrifices to achieve a long-term goal.",
    coachTip: "Clarify the trade-off. Detail what you had to postpone or absorb, how you communicated with stakeholders, and the ultimate payoff.",
    starFocus: "Situation & Strategy",
  },
  {
    id: "lead-9",
    category: "leadership",
    prompt: "Describe a situation where you had to delegate responsibilities effectively under pressure.",
    coachTip: "Demonstrate trust in teammates' capabilities, clear acceptance criteria, and periodic check-ins without micromanaging.",
    starFocus: "Action & Delegation",
  },
  {
    id: "lead-10",
    category: "leadership",
    prompt: "Tell me about a time you championed a new standard, tool, or process within your team.",
    coachTip: "Highlight change management: building a working prototype, gathering peer feedback, lowering switching friction, and tracking adoption.",
    starFocus: "Action & Adoption",
  },

  // 2. Teamwork & Conflict Resolution (10 questions)
  {
    id: "team-1",
    category: "teamwork",
    prompt: "Tell me about a time you had a fundamental disagreement with a teammate and how you resolved it.",
    coachTip: "Depersonalize the disagreement. Focus on grounding choices in shared user or technical goals, active listening, and reaching consensus.",
    starFocus: "Action & Conflict Resolution",
  },
  {
    id: "team-2",
    category: "teamwork",
    prompt: "Describe an experience working with someone whose communication or working style was difficult.",
    coachTip: "Show professional empathy and adaptability. Detail how you shifted communication mediums or cadence to establish productive rapport.",
    starFocus: "Action & Communication",
  },
  {
    id: "team-3",
    category: "teamwork",
    prompt: "Tell me about a time you had to deliver critical or constructive feedback to a peer.",
    coachTip: "Describe timely, private, behavior-focused, and compassionate feedback. Explain the positive impact on their work and your relationship.",
    starFocus: "Action & Constructive Feedback",
  },
  {
    id: "team-4",
    category: "teamwork",
    prompt: "Describe a situation where you disagreed with a manager or senior lead's technical direction. How did you handle it?",
    coachTip: "Show professional pushback supported by data, benchmarks, or prototypes, while upholding organizational alignment if overruled.",
    starFocus: "Action & Respectful Pushback",
  },
  {
    id: "team-5",
    category: "teamwork",
    prompt: "Tell me about a time you had to \"disagree and commit\" after an idea you proposed was rejected.",
    coachTip: "Demonstrate intellectual humility and team loyalty: once the decision was finalized, how did you execute it with complete energy?",
    starFocus: "Action & Alignment",
  },
  {
    id: "team-6",
    category: "teamwork",
    prompt: "Give an example of how you build trust and rapport quickly with new collaborators.",
    coachTip: "Mention delivering reliably on early small commitments, being open about what you don't know, and celebrating others' wins.",
    starFocus: "Action & Trust Building",
  },
  {
    id: "team-7",
    category: "teamwork",
    prompt: "Describe a time a project suffered due to miscommunication. What did you do to rectify it?",
    coachTip: "Take shared responsibility without finger-pointing. Detail the new communication guardrails (e.g. RFCs, daily standup specs) you introduced.",
    starFocus: "Situation & Action",
  },
  {
    id: "team-8",
    category: "teamwork",
    prompt: "Tell me about a time you mediated a conflict between two teammates with opposing viewpoints.",
    coachTip: "Highlight neutral facilitation: ensuring both sides felt heard, identifying underlying shared incentives, and synthesizing a compromise.",
    starFocus: "Action & Mediation",
  },
  {
    id: "team-9",
    category: "teamwork",
    prompt: "Describe a time you had to negotiate responsibilities or compromises across cross-functional teams.",
    coachTip: "Focus on cross-discipline empathy (engineering, product, design). How did you align timelines and trade-offs to keep the ship date intact?",
    starFocus: "Action & Negotiation",
  },
  {
    id: "team-10",
    category: "teamwork",
    prompt: "Tell me about a time you shared credit for a success that wouldn't have been possible alone.",
    coachTip: "Genuinely acknowledge teammates' contributions while still clearly articulating your own specific contributions and responsibilities.",
    starFocus: "Result & Recognition",
  },

  // 3. Problem Solving, Innovation & Technical Execution (10 questions)
  {
    id: "prob-1",
    category: "problem_solving",
    prompt: "Walk me through the most technically complex challenge or bug you've had to solve.",
    coachTip: "Explain complexity in clear terms. Walk through your scientific method: hypothesis formulation, instrumentation/profiling, root cause, and fix.",
    starFocus: "Action & Analytical Rigor",
  },
  {
    id: "prob-2",
    category: "problem_solving",
    prompt: "Tell me about a time you had to simplify an overly complicated system or process.",
    coachTip: "Explain what caused the complexity, how you safely pruned redundant layers, and the resulting improvements in latency or maintainability.",
    starFocus: "Task & System Simplification",
  },
  {
    id: "prob-3",
    category: "problem_solving",
    prompt: "Describe an instance where you identified the root cause of a recurring, elusive problem.",
    coachTip: "Highlight methodical investigative work (telemetry, log traces, race condition reproduction) rather than guesswork or superficial patches.",
    starFocus: "Action & Root Cause Analysis",
  },
  {
    id: "prob-4",
    category: "problem_solving",
    prompt: "Tell me about a time you devised a creative solution with severely constrained resources or budget.",
    coachTip: "Show inventive resourcefulness: repurposing existing architecture, building lightweight scripts, or finding clever open-source tooling.",
    starFocus: "Situation & Innovation",
  },
  {
    id: "prob-5",
    category: "problem_solving",
    prompt: "Describe a time you used data to persuade skeptics to change direction.",
    coachTip: "Detail the specific data gathered, how you presented or visualized it clearly, and how objective numbers changed minds.",
    starFocus: "Action & Data-Driven Persuasion",
  },
  {
    id: "prob-6",
    category: "problem_solving",
    prompt: "Tell me about a time you had to quickly learn an unfamiliar technology, stack, or domain to deliver a project.",
    coachTip: "Demonstrate rapid learning velocity: researching core specs, building quick spike experiments, and shipping production-grade work.",
    starFocus: "Action & Rapid Learning",
  },
  {
    id: "prob-7",
    category: "problem_solving",
    prompt: "Describe a scenario where a project requirement abruptly changed mid-development and how you adapted.",
    coachTip: "Show architectural agility: evaluating what components could be salvaged, refactoring cleanly, and preventing team frustration.",
    starFocus: "Situation & Adaptation",
  },
  {
    id: "prob-8",
    category: "problem_solving",
    prompt: "Tell me about a time you balanced technical debt against the need to ship quickly.",
    coachTip: "Demonstrate pragmatic trade-offs: taking deliberate, well-documented debt to meet critical timing, with an explicit plan to pay it down.",
    starFocus: "Task & Technical Pragmatism",
  },
  {
    id: "prob-9",
    category: "problem_solving",
    prompt: "Describe an innovative feature or tool you conceptualized and built from scratch.",
    coachTip: "Describe the user problem, your initial prototype, user testing feedback, and the quantitative impact post-launch.",
    starFocus: "Action & Innovation",
  },
  {
    id: "prob-10",
    category: "problem_solving",
    prompt: "Tell me about a time you had to debug an issue in production under intense time pressure.",
    coachTip: "Show calmness and prioritized triage: stopping the bleeding first (failover, rollback, or kill-switch), followed by post-mortem remediation.",
    starFocus: "Action & High Pressure Debugging",
  },

  // 4. Handling Failure, Mistakes & Adaptability (10 questions)
  {
    id: "fail-1",
    category: "failure",
    prompt: "Tell me about a significant mistake you made at work or on a project. How did you handle the fallout?",
    coachTip: "Take direct ownership with zero blame-shifting. Detail immediate containment, transparent communication, and preventative safeguards instituted.",
    starFocus: "Action & Accountability",
  },
  {
    id: "fail-2",
    category: "failure",
    prompt: "Describe a time a project you worked on failed or missed its core objective. What did you learn?",
    coachTip: "Demonstrate mature retrospection. What assumptions proved wrong, what did the post-mortem reveal, and how did it change your engineering habits?",
    starFocus: "Result & Introspective Learning",
  },
  {
    id: "fail-3",
    category: "failure",
    prompt: "Tell me about a time you received harsh or unexpected critical feedback. How did you react?",
    coachTip: "Show emotional regulation: processing the critique without becoming defensive, finding the valuable signal, and making visible improvements.",
    starFocus: "Action & Receptivity to Feedback",
  },
  {
    id: "fail-4",
    category: "failure",
    prompt: "Describe a situation where you realized halfway through that you were heading down the wrong technical path.",
    coachTip: "Overcoming the sunk cost fallacy. Show the courage to raise the alarm early, present a pivot plan, and preserve project timelines.",
    starFocus: "Action & Course Correction",
  },
  {
    id: "fail-5",
    category: "failure",
    prompt: "Tell me about a time you made a decision based on incomplete information that turned out to be wrong.",
    coachTip: "Explain why a fast decision was necessary, how you monitored early warning signals, and how swiftly you adapted when new facts arrived.",
    starFocus: "Situation & Fast Recovery",
  },
  {
    id: "fail-6",
    category: "failure",
    prompt: "Describe a situation where your code or proposal was heavily criticized during a review.",
    coachTip: "Show ego-free engineering: welcoming thorough scrutiny to elevate software quality, engaging constructively, and thanking reviewers.",
    starFocus: "Action & Humility",
  },
  {
    id: "fail-7",
    category: "failure",
    prompt: "Tell me about a time you had to deliver bad news to a stakeholder, client, or team lead.",
    coachTip: "Proactive communication is key: delivering the message early, with full transparency, accompanied by concrete options and revised projections.",
    starFocus: "Action & Transparent Communication",
  },
  {
    id: "fail-8",
    category: "failure",
    prompt: "Describe a time you felt completely overwhelmed by project deadlines. How did you prioritize?",
    coachTip: "Demonstrate systematic triaging: separating nice-to-haves from critical path deliverables, negotiating scope, and maintaining quality under stress.",
    starFocus: "Task & Prioritization Under Stress",
  },
  {
    id: "fail-9",
    category: "failure",
    prompt: "Tell me about an instance where an unexpected technical roadblock completely derailed your timeline.",
    coachTip: "Explain the unforeseen blocker, your rapid reassessment of options, communicating revised milestones, and successfully crossing the finish line.",
    starFocus: "Situation & Resilience",
  },
  {
    id: "fail-10",
    category: "failure",
    prompt: "Describe a time you failed to meet a commitment or milestone. How did you manage expectations?",
    coachTip: "Highlight early notification before the deadline hit, candid status reporting, taking personal responsibility, and delivering on the new plan.",
    starFocus: "Action & Expectation Management",
  },

  // 5. Ambiguity, Prioritization & Decision-Making (10 questions)
  {
    id: "ambi-1",
    category: "ambiguity",
    prompt: "Tell me about a time you were assigned a project with ambiguous or poorly defined requirements.",
    coachTip: "Show proactive structuring: asking targeted questions, drafting an RFC or 1-pager spec, establishing boundaries, and iterating with stakeholders.",
    starFocus: "Task & Structuring Ambiguity",
  },
  {
    id: "ambi-2",
    category: "ambiguity",
    prompt: "Describe a situation where you had to make a high-stakes decision without manager guidance.",
    coachTip: "Walk through your framework: assessing worst-case blast radius, consulting available documentation and principles, and owning the outcome.",
    starFocus: "Action & Independent Judgment",
  },
  {
    id: "ambi-3",
    category: "ambiguity",
    prompt: "How do you decide what to cut when you have 5 competing high-priority tasks and insufficient time?",
    coachTip: "Describe your prioritization criteria (user impact, deadline urgency, strategic alignment), confirming trade-offs with stakeholders, and focus.",
    starFocus: "Task & Triage Framework",
  },
  {
    id: "ambi-4",
    category: "ambiguity",
    prompt: "Tell me about a time you took a calculated risk where speed of execution was critical.",
    coachTip: "Differentiate calculated risks from recklessness: describe the guardrails, circuit breakers, and monitoring that protected the system.",
    starFocus: "Action & Risk Management",
  },
  {
    id: "ambi-5",
    category: "ambiguity",
    prompt: "Describe a situation where customer or user needs conflicted directly with internal technical priorities.",
    coachTip: "Demonstrate balanced thinking: finding a staged roadmap that satisfied pressing user needs while scheduling necessary debt remediation.",
    starFocus: "Action & Strategic Compromise",
  },
  {
    id: "ambi-6",
    category: "ambiguity",
    prompt: "Tell me about a time you had to evaluate tradeoffs between two equally viable architectural options.",
    coachTip: "Outline evaluation dimensions: scalability, maintainability, development velocity, team familiarity, and how you reached consensus.",
    starFocus: "Action & Architectural Trade-offs",
  },
  {
    id: "ambi-7",
    category: "ambiguity",
    prompt: "Describe how you prioritize feature requests when incoming feedback is contradictory.",
    coachTip: "Look past vocal outliers to behavioral analytics, group users by core personas, and evaluate alignment with the core product mission.",
    starFocus: "Action & Product Discernment",
  },
  {
    id: "ambi-8",
    category: "ambiguity",
    prompt: "Tell me about a time you had to define success metrics for an open-ended initiative.",
    coachTip: "Explain how you balanced leading indicators (engagement, task completion) with lagging outcomes (retention, reliability), and counter-metrics.",
    starFocus: "Task & Metric Formulation",
  },
  {
    id: "ambi-9",
    category: "ambiguity",
    prompt: "Describe an instance where you pivoted project direction based on early user signals or data.",
    coachTip: "Highlight intellectual flexibility: spotting early telemetry that contradicted prior hypotheses, course-correcting quickly, and gaining buy-in.",
    starFocus: "Action & Agility",
  },
  {
    id: "ambi-10",
    category: "ambiguity",
    prompt: "Tell me about a time you anticipated a critical problem before it happened and took preventative action.",
    coachTip: "Demonstrate architectural foresight (e.g. stress-testing traffic peaks, security threat modeling), acting before issues became customer-facing.",
    starFocus: "Situation & Proactive Prevention",
  },
];
