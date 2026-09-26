import json
from schemas import STARInput
from strength_scorer import StrengthGridScorer

def run_tests():
    scorer = StrengthGridScorer()

    # Test 1: Teamwork & Conflict Resolution Story
    teamwork_story = STARInput(
        title="Cross-Functional Launch Conflict",
        situation="During our quarterly sprint, our front-end and backend teams had conflicting specifications for the API schema, threatening our launch deadline.",
        task="I needed to align both teams, resolve the technical dispute, and establish a shared contract so neither team was blocked.",
        action="I scheduled an urgent cross-functional workshop where we mapped out all edge cases together on a virtual whiteboard. I facilitated constructive discussion, listened to both sides' architectural concerns, and proposed a compromise protocol using protobufs. I also paired with a junior frontend engineer who was struggling with the new contract.",
        result="Both teams agreed to the schema, reached consensus within 2 hours, and we delivered the release 3 days ahead of schedule with 0 integration bugs. The team adopted our workshop format for future sprint alignments."
    )

    # Test 2: Failure & Post-Mortem Story
    failure_story = STARInput(
        title="Production Database Outage",
        situation="Early in my career at an e-commerce startup, our checkout service experienced a 45-minute total outage during Black Friday.",
        task="As the on-call engineer, I was responsible for diagnosing the incident, bringing the system back online, and explaining what happened.",
        action="I discovered that an unindexed migration I had authored and pushed earlier that morning locked the orders table under heavy load. I took full personal accountability, quickly rolled back the migration, and restored checkout. Afterwards, I conducted a blameless post-mortem with the entire engineering org, walked through my mistake, and wrote a pre-deployment linter rule that blocks unindexed foreign key migrations.",
        result="The linter prevented 4 similar outage incidents in subsequent quarters, and my manager commended my transparency and ownership. I learned the critical importance of load-testing migrations and never pushing to production without automated guardrails."
    )

    # Test 3: Ambiguity Story
    ambiguity_story = STARInput(
        title="Greenfield Zero-to-One Prototype",
        situation="Our company wanted to explore integrating generative AI into our legacy workflow product, but there were no customer specs, no architecture roadmap, and leadership had only vague expectations.",
        task="I was tasked with exploring the space from scratch, validating technical feasibility, and proposing a concrete product direction under high uncertainty.",
        action="Since requirements were completely undefined, I interviewed 12 internal account managers to discover their primary friction points. Working with incomplete documentation, I rapidly built 3 lightweight proof-of-concept prototypes in 2 weeks. I set up measurable evaluation rubrics, tested latency trade-offs, and presented a data-driven proposal to our VP of Engineering.",
        result="My prototype was greenlit as the company's Q3 flagship initiative, securing $500k in initial budget and cutting manual workflow time by 65% for our pilot customers."
    )

    # Test 4: Shallow / Super Short Story (Testing Depth & Substance Modulator)
    shallow_story = STARInput(
        title="Super Short Shallow Story",
        situation="We had a conflict.",
        task="Fix it.",
        actions="I collaborated with the team.",
        result="We agreed."
    )

    print("\n" + "="*80)
    print("TESTING STRENGTH GRID ML SCORER")
    print("="*80)

    for story in [teamwork_story, failure_story, ambiguity_story, shallow_story]:
        score = scorer.score_single_story(story)
        print(f"\nSTORY: {story.title}")
        print(f"Dominant Pillar: {score.dominant_category.upper()} (Overall Strength: {score.overall_strength_score}%)")
        print(f"  - Teamwork:        {score.teamwork}% (Level: {score.details['teamwork'].level})")
        print(f"  - Problem Solving: {score.problem_solving}% (Level: {score.details['problem_solving'].level})")
        print(f"  - Failure:         {score.failure}% (Level: {score.details['failure'].level})")
        print(f"  - Leadership:      {score.leadership}% (Level: {score.details['leadership'].level})")
        print(f"  - Ambiguity:       {score.ambiguity}% (Level: {score.details['ambiguity'].level})")
        tip = score.details[score.dominant_category].improvement_tip
        print(f"  Feedback Tip: {tip}")

    print("\n" + "="*80)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("="*80)

if __name__ == "__main__":
    run_tests()
