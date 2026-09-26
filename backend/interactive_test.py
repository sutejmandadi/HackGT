import sys
from schemas import STARInput
from strength_scorer import StrengthGridScorer


def render_bar(percentage: float, width: int = 25) -> str:
    filled = int(round(width * (percentage / 100.0)))
    bar = "█" * filled + "░" * (width - filled)
    return f"[{bar}] {percentage:5.1f}%"


def test_story(scorer: StrengthGridScorer, title: str, s: str, t: str, a: str, r: str):
    story = STARInput(
        id="test_interactive",
        title=title,
        situation=s,
        task=t,
        actions=a,
        result=r
    )
    result = scorer.score_single_story(story)

    print("\n" + "=" * 65)
    print(f"📊 STRENGTH GRID SCORECARD: {result.title.upper()}")
    print("=" * 65)
    print(f"Dominant Behavioral Pillar: 🏆 {result.dominant_category.upper()}")
    print(f"Overall Behavioral Strength: {result.overall_strength_score}%\n")
    print(f"  Teamwork:        {render_bar(result.teamwork)}")
    print(f"  Problem Solving: {render_bar(result.problem_solving)}")
    print(f"  Failure:         {render_bar(result.failure)}")
    print(f"  Leadership:      {render_bar(result.leadership)}")
    print(f"  Ambiguity:       {render_bar(result.ambiguity)}")

    print("\n🔍 KEY SIGNALS DETECTED:")
    for cat, detail in result.details.items():
        if detail.percentage >= 45.0:
            signals = ", ".join(detail.signals_detected) if detail.signals_detected else "Semantic match"
            print(f"  • {detail.label} ({detail.percentage}% - {detail.level}): {signals}")

    print("\n💡 TOP SUGGESTION FOR IMPROVEMENT:")
    # Find lowest category
    lowest_cat = min(result.details.items(), key=lambda x: x[1].percentage)
    print(f"  • {lowest_cat[1].label} ({lowest_cat[1].percentage}%): {lowest_cat[1].improvement_tip}")
    print("=" * 65 + "\n")


def main():
    print("=" * 65)
    print("🤖 AI BEHAVIORAL INTERVIEW STRENGTH GRID TESTER")
    print("=" * 65)
    print("Loading ML model (sentence-transformers/all-MiniLM-L6-v2)...")
    scorer = StrengthGridScorer()
    print("Ready!\n")

    while True:
        print("Choose an option:")
        print("  1. Test Sample Story 1: Cross-Functional Team Conflict (Teamwork)")
        print("  2. Test Sample Story 2: Critical Database Outage & Post-Mortem (Failure)")
        print("  3. Test Sample Story 3: Greenfield AI Prototype under High Uncertainty (Ambiguity)")
        print("  4. Enter your OWN custom story (type/paste Situation, Task, Actions, Result)")
        print("  5. Exit")
        
        choice = input("\nEnter choice (1-5): ").strip()

        if choice == "1":
            test_story(
                scorer,
                "Cross-Functional Team Conflict",
                "Our front-end and backend teams had conflicting specifications for the API schema, threatening our sprint deadline.",
                "I needed to align both teams, resolve the dispute, and establish a shared contract.",
                "I scheduled an urgent cross-functional workshop, mapped out edge cases on a whiteboard, listened to both sides, and proposed a compromise protocol using protobufs. I paired with a junior engineer to help them adapt.",
                "Both teams reached consensus in 2 hours and we delivered the release 3 days early with 0 bugs."
            )
        elif choice == "2":
            test_story(
                scorer,
                "Critical Database Outage & Post-Mortem",
                "Early in my career, our checkout service experienced a 45-minute total outage during Black Friday.",
                "As on-call engineer, I was responsible for diagnosing the incident and bringing the system back online.",
                "I discovered an unindexed migration I had authored locked the orders table. I took full personal accountability, quickly rolled back the migration, and held a blameless post-mortem with engineering org to walk through my mistake.",
                "Wrote a pre-deployment linter preventing 4 similar outages. I learned to never push to prod without automated guardrails."
            )
        elif choice == "3":
            test_story(
                scorer,
                "Greenfield AI Prototype under High Uncertainty",
                "Our company wanted to explore integrating generative AI into our legacy workflow product, but there were no customer specs and leadership had only vague expectations.",
                "I was tasked with exploring the space from scratch and validating technical feasibility under high uncertainty.",
                "Since requirements were completely undefined, I interviewed 12 internal stakeholders, built 3 rapid prototypes in 2 weeks, and formulated an evaluation rubric.",
                "Prototype was greenlit as the flagship initiative with a $500k budget, cutting manual workflow time by 65%."
            )
        elif choice == "4":
            print("\n--- Enter Your Custom Story ---")
            title = input("Story Title: ").strip() or "Custom Story"
            s = input("Situation: ").strip()
            t = input("Task: ").strip()
            a = input("Actions: ").strip()
            r = input("Result: ").strip()
            test_story(scorer, title, s, t, a, r)
        elif choice == "5":
            print("Exiting. Good luck at HackGT!")
            break
        else:
            print("Invalid choice, please select 1-5.")


if __name__ == "__main__":
    main()
