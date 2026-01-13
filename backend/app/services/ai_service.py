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
        """Enhance imported tasks with AI suggestions and intelligent analysis."""
        if not self.enabled:
            return None

        try:
            # Build a rich summary including all available fields
            tasks_summary = []
            for t in tasks[:25]:
                task_info = f"- {t.get('title', 'N/A')}"
                if t.get('description'):
                    task_info += f" | Desc: {t.get('description', '')[:80]}..."
                if t.get('priority'):
                    task_info += f" | Priority: {t.get('priority')}"
                if t.get('story_points'):
                    task_info += f" | Points: {t.get('story_points')}"
                if t.get('status'):
                    task_info += f" | Status: {t.get('status')}"
                if t.get('assignee'):
                    task_info += f" | Assignee: {t.get('assignee')}"
                tasks_summary.append(task_info)

            prompt = f"""Analyze these imported tasks and provide intelligent enhancement suggestions:

IMPORTED TASKS:
{chr(10).join(tasks_summary)}

ANALYSIS REQUIRED:
1. For tasks with vague or overly short titles (like numbers or single words), suggest a better title based on context
2. Identify tasks that appear to be parent tasks vs subtasks
3. Suggest priorities (P0=Critical, P1=High, P2=Medium, P3=Low, P4=Lowest) based on task nature
4. Estimate story points (1, 2, 3, 5, 8, 13) based on apparent complexity
5. Flag potential duplicates or highly related tasks that could be merged
6. Identify any tasks that should be broken down into subtasks
7. Detect the overall project type and recommend workflow improvements

Respond in JSON format:
{{
    "enhanced_tasks": [
        {{
            "original_title": "...",
            "suggested_title": "..." or null if title is already good,
            "title_issue": "too_short|vague|is_number|none",
            "suggested_priority": "P0|P1|P2|P3|P4" or null,
            "priority_reason": "brief explanation",
            "suggested_points": <number 1-13> or null,
            "points_reason": "brief explanation",
            "is_likely_parent_task": true/false,
            "suggested_subtasks": ["subtask1", ...] or [],
            "notes": "any other suggestions"
        }}
    ],
    "potential_duplicates": [
        {{"tasks": ["title1", "title2"], "similarity": "high|medium", "reason": "..."}}
    ],
    "related_task_groups": [
        {{"group_name": "...", "tasks": ["task1", "task2"], "suggestion": "..."}}
    ],
    "project_analysis": {{
        "detected_type": "software_development|marketing|design|operations|research|general",
        "detected_methodology": "agile|waterfall|kanban|hybrid|unclear",
        "overall_quality": "high|medium|low",
        "missing_info": ["what's commonly missing from these tasks"]
    }},
    "workflow_suggestions": ["suggestion 1", "suggestion 2"],
    "import_warnings": ["any concerns about the data quality"]
}}"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert project manager and agile coach analyzing imported task data.
Your goal is to help transform raw imported data into well-structured, actionable tasks.
Be practical, specific, and focus on improvements that will make the tasks clearer and more actionable.
When suggesting titles, make them action-oriented (start with verbs like "Implement", "Create", "Fix", "Update").
For story points, consider: 1=trivial, 2=small, 3=medium, 5=large, 8=very large, 13=epic-sized.""",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=2000,
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI task enhancement failed: {e}")
            return None

    def analyze_spreadsheet_structure(self, headers: list, sample_rows: list, raw_preview: str = "") -> Optional[dict]:
        """Use AI to analyze spreadsheet structure and suggest optimal column mappings."""
        if not self.enabled:
            return None

        try:
            # Build context about the data
            headers_info = ", ".join(headers[:15])
            sample_data = []
            for row in sample_rows[:5]:
                row_preview = " | ".join([f"{k}: {str(v)[:30]}" for k, v in list(row.items())[:8] if v])
                sample_data.append(row_preview)

            prompt = f"""Analyze this spreadsheet structure and determine the best column mappings for a task management system.

DETECTED HEADERS: {headers_info}

SAMPLE DATA (first 5 rows):
{chr(10).join(sample_data)}

{f"RAW PREVIEW: {raw_preview[:500]}" if raw_preview else ""}

Analyze and determine:
1. Which column contains the task TITLE (the main task name/description)?
2. Which column contains detailed DESCRIPTION (if separate from title)?
3. Which column indicates PRIORITY?
4. Which column has story points or time ESTIMATES?
5. Which column shows STATUS?
6. Which column has ASSIGNEE information?
7. Which columns have DATES (start/due)?
8. Are there any ID columns that indicate hierarchy (parent/child tasks)?
9. Is the header row in the correct position, or is there metadata above it?

Respond in JSON format:
{{
    "suggested_mapping": {{
        "title": "column_name" or null,
        "description": "column_name" or null,
        "priority": "column_name" or null,
        "story_points": "column_name" or null,
        "status": "column_name" or null,
        "assignee": "column_name" or null,
        "due_date": "column_name" or null,
        "start_date": "column_name" or null,
        "labels": "column_name" or null
    }},
    "mapping_confidence": <0-100>,
    "header_analysis": {{
        "detected_header_row": <row_number>,
        "has_metadata_rows": true/false,
        "metadata_description": "description of any metadata found above headers"
    }},
    "data_insights": {{
        "appears_hierarchical": true/false,
        "hierarchy_column": "column_name" or null,
        "id_column": "column_name" or null,
        "data_quality": "good|fair|poor",
        "issues_detected": ["issue1", "issue2"]
    }},
    "recommendations": ["recommendation 1", "recommendation 2"]
}}"""

            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """You are an expert at analyzing spreadsheet data for project management imports.
Your task is to intelligently map columns to task fields and identify data structure patterns.
Be precise in identifying which columns contain which types of data.
Consider common variations in column naming (e.g., "Task Name", "Title", "Name" all mean title).""",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                max_tokens=800,
            )

            return json.loads(response.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI spreadsheet analysis failed: {e}")
            return None


# Singleton instance
_ai_service = None


def get_ai_service() -> AIService:
    """Get the singleton AI service instance."""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
