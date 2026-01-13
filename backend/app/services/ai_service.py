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


# Singleton instance
_ai_service = None


def get_ai_service() -> AIService:
    """Get the singleton AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
