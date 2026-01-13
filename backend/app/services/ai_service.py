"""AI service abstraction for LLM integrations."""

import os
import json
import logging
from typing import Optional
from openai import OpenAI

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered features using OpenAI."""

    def __init__(self):
        api_key = os.environ.get("OPENAI_API_KEY")
        if api_key:
            self.client = OpenAI(api_key=api_key)
            self.enabled = True
        else:
            self.client = None
            self.enabled = False
            logger.warning("OpenAI API key not configured. AI features disabled.")

    def is_enabled(self) -> bool:
        """Check if AI service is available."""
        return self.enabled

    def suggest_card_improvements(self, card_data: dict) -> Optional[dict]:
        """Suggest improvements for a card (title, description, acceptance criteria)."""
        if not self.enabled:
            return None

        try:
            prompt = f"""Analyze this task card and suggest improvements:

Title: {card_data.get('title', 'N/A')}
Description: {card_data.get('description', 'N/A')}
Priority: {card_data.get('priority', 'N/A')}
Story Points: {card_data.get('story_points', 'N/A')}

Please provide:
1. An improved, more actionable title if needed
2. A clearer description with acceptance criteria
3. Suggested story points estimate if current seems off
4. Any potential subtasks to break this down

Respond in JSON format:
{{
    "improved_title": "...",
    "improved_description": "...",
    "suggested_story_points": <number>,
    "subtasks": ["task1", "task2", ...],
    "notes": "any additional suggestions"
}}"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an agile coach helping teams write better user stories and tasks. Be concise and practical.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=500,
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI card improvement suggestion failed: {e}")
            return None

    def groom_backlog(self, cards: list[dict]) -> Optional[dict]:
        """Analyze backlog and provide grooming suggestions."""
        if not self.enabled:
            return None

        try:
            cards_summary = "\n".join(
                [
                    f"- [{c.get('priority', 'N/A')}] {c.get('title')} ({c.get('story_points', '?')} pts)"
                    for c in cards[:20]  # Limit to 20 cards
                ]
            )

            prompt = f"""Analyze this product backlog and provide grooming suggestions:

Backlog Items:
{cards_summary}

Please analyze and provide:
1. Priority recommendations (any items that should be reprioritized)
2. Cards that might need to be split (too large)
3. Cards that could be combined (too small or duplicates)
4. Missing items you'd expect to see based on the backlog
5. Overall backlog health assessment

Respond in JSON format:
{{
    "priority_recommendations": [
        {{"card_title": "...", "current_priority": "...", "suggested_priority": "...", "reason": "..."}}
    ],
    "split_recommendations": [
        {{"card_title": "...", "reason": "...", "suggested_split": ["subtask1", "subtask2"]}}
    ],
    "combine_recommendations": [
        {{"cards": ["card1", "card2"], "reason": "..."}}
    ],
    "missing_items": ["item1", "item2"],
    "health_score": <1-10>,
    "health_summary": "..."
}}"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an experienced agile product owner helping groom backlogs. Focus on actionable, practical suggestions.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=1000,
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI backlog grooming failed: {e}")
            return None

    def generate_sprint_goal(self, sprint_cards: list[dict], project_context: str = "") -> Optional[str]:
        """Generate a sprint goal based on selected cards."""
        if not self.enabled:
            return None

        try:
            cards_summary = "\n".join(
                [f"- {c.get('title')}" for c in sprint_cards[:15]]
            )

            prompt = f"""Based on these cards planned for a sprint, generate a concise sprint goal:

Project Context: {project_context or 'Not specified'}

Sprint Cards:
{cards_summary}

Generate a single, motivating sprint goal (1-2 sentences) that captures the theme and value delivered.
Respond with just the goal text, no JSON."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a scrum master helping teams define clear sprint goals. Be concise and value-focused.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=100,
            )

            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"AI sprint goal generation failed: {e}")
            return None

    def suggest_daily_log_summary(self, tasks_worked: list[dict], blockers: str = "") -> Optional[str]:
        """Generate a summary for daily standup based on work logged."""
        if not self.enabled:
            return None

        try:
            tasks_summary = "\n".join(
                [
                    f"- {t.get('title', 'Task')}: {t.get('time_spent', 0)} mins - {t.get('notes', 'N/A')}"
                    for t in tasks_worked
                ]
            )

            prompt = f"""Generate a brief daily standup summary based on this work log:

Tasks Worked On:
{tasks_summary}

Blockers: {blockers or 'None'}

Generate a concise 2-3 sentence standup update in first person.
Respond with just the summary text."""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "Generate brief, professional daily standup summaries.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_tokens=150,
            )

            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"AI daily log summary failed: {e}")
            return None

    def generate_retrospective_summary(self, sprint_context: dict) -> Optional[dict]:
        """Generate AI summary and insights for a sprint retrospective."""
        if not self.enabled:
            return None

        try:
            # Build context summary
            notes_summary = ""
            if sprint_context.get("notes"):
                notes_by_type = {}
                for note in sprint_context["notes"]:
                    note_type = note.get("note_type", "general")
                    if note_type not in notes_by_type:
                        notes_by_type[note_type] = []
                    notes_by_type[note_type].append(note.get("content", ""))

                for ntype, contents in notes_by_type.items():
                    notes_summary += f"\n{ntype.upper()}:\n" + "\n".join(f"- {c}" for c in contents)

            retro_data = sprint_context.get("retrospective", {}) or {}

            prompt = f"""Analyze this sprint and generate a retrospective summary with actionable insights.

SPRINT DATA:
- Name: {sprint_context.get('sprint_name', 'N/A')}
- Goal: {sprint_context.get('sprint_goal', 'Not specified')}
- Total cards: {sprint_context.get('total_cards', 0)}
- Completed: {sprint_context.get('completed_cards', 0)}
- Incomplete tasks: {', '.join(sprint_context.get('incomplete_cards', [])[:10]) or 'None'}
- Completed tasks: {', '.join(sprint_context.get('completed_titles', [])[:10]) or 'None'}

TEAM NOTES DURING SPRINT:{notes_summary or ' None recorded'}

RETROSPECTIVE INPUTS:
- What went well: {retro_data.get('what_went_well', 'Not provided')}
- What went wrong: {retro_data.get('what_went_wrong', 'Not provided')}
- Team mood (1-5): {retro_data.get('team_mood', 'Not rated')}

Please provide:
1. A concise summary (2-3 paragraphs) of the sprint outcome
2. Key insights and patterns detected
3. Specific, actionable recommendations for the next sprint

Respond in JSON format:
{{
    "summary": "...",
    "insights": [
        {{"category": "velocity|scope|blockers|collaboration|quality", "finding": "...", "severity": "info|warning|critical"}}
    ],
    "recommendations": [
        {{"action": "...", "priority": "high|medium|low", "rationale": "..."}}
    ],
    "health_score": <1-10>,
    "key_wins": ["win1", "win2"],
    "areas_for_improvement": ["area1", "area2"]
}}"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an experienced agile coach helping teams reflect on sprints. Provide honest, constructive feedback. Focus on patterns and actionable improvements, not blame.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=1000,
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI retrospective summary generation failed: {e}")
            return None

    def enhance_imported_tasks(self, tasks: list[dict]) -> Optional[dict]:
        """Enhance imported tasks with AI suggestions."""
        if not self.enabled:
            return None

        try:
            tasks_summary = "\n".join(
                [f"- {t.get('title', 'N/A')}: {t.get('description', 'No description')[:100]}"
                 for t in tasks[:20]]
            )

            prompt = f"""Analyze these imported tasks and provide enhancement suggestions:

IMPORTED TASKS:
{tasks_summary}

For each task, analyze and provide:
1. Improved/clarified title if it's vague
2. Suggested priority (P0-P4) if not set
3. Estimated story points (1, 2, 3, 5, 8, 13) based on complexity
4. Any subtasks that could be broken out
5. Flag potential duplicate or related tasks

Respond in JSON format:
{{
    "enhanced_tasks": [
        {{
            "original_title": "...",
            "suggested_title": "..." or null if no change needed,
            "suggested_priority": "P0|P1|P2|P3|P4" or null,
            "suggested_points": <number> or null,
            "subtasks": ["subtask1", ...] or [],
            "notes": "any suggestions or flags"
        }}
    ],
    "potential_duplicates": [
        {{"tasks": ["title1", "title2"], "reason": "..."}}
    ],
    "suggestions": ["overall suggestion 1", "..."]
}}"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": "You are an agile coach helping refine imported task lists. Be practical and concise.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=1500,
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI task enhancement failed: {e}")
            return None


# Singleton instance
_ai_service = None


def get_ai_service() -> AIService:
    """Get the singleton AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
