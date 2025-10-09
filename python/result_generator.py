"""
Result Generator for Evaluation Outputs

This module provides utilities to generate and save evaluation results in a structured format.
Results are saved as text files in subfolders under results/ corresponding to each evaluation.
Each evaluation gets its own subfolder, as defined by the EvalName enum:
- Model name
- Date and time
- Input tokens
- Output tokens
- Execution time
"""

import os
import json
from datetime import datetime
from typing import Dict, Any, Optional, List, Union
from pathlib import Path
from enum import Enum


class EvalName(Enum):
    AUTH_APPLY = "auth_apply"
    FILE_UPLOAD = "file_upload"

    @classmethod
    def list(cls) -> List[str]:
        return [e.value for e in cls]

    @classmethod
    def from_str(cls, name: str) -> "EvalName":
        norm = name.replace("-", "_").lower()
        for member in cls:
            if member.value == norm or member.name.lower() == norm:
                return member
        raise ValueError(f"{name} is not a recognized evaluation name")


class EvaluationResult:
    """Class to handle evaluation result generation and storage, including per-eval subfolders."""

    def __init__(self, results_dir: str = "results"):
        """
        Initialize the result generator.

        Args:
            results_dir: Directory to store result files (relative to project root)
        """
        # Get project root (assuming this script is in python/ directory)
        script_dir = Path(__file__).parent
        project_root = script_dir.parent
        self.results_dir = project_root / results_dir

        # Ensure results root directory exists
        self.results_dir.mkdir(exist_ok=True)

    def get_eval_subdir(self, eval_name: Union[str, EvalName]) -> Path:
        """Get the directory for this evaluation name, creating it if needed."""
        if isinstance(eval_name, EvalName):
            eval_str = eval_name.value
        else:
            try:
                eval_str = EvalName.from_str(eval_name).value
            except Exception:
                eval_str = str(eval_name)
        eval_dir = self.results_dir / eval_str
        eval_dir.mkdir(exist_ok=True)
        return eval_dir

    def generate_result_filename(
        self, eval_name: Union[str, EvalName], model_name: str, timestamp: Optional[datetime] = None
    ) -> str:
        """
        Generate a standardized filename for result files.

        Args:
            eval_name: Name of the evaluation (EvalName enum or str)
            model_name: Name of the model used
            timestamp: Timestamp for the evaluation (defaults to now)

        Returns:
            Standardized filename string (model name and timestamp)
        """
        if timestamp is None:
            timestamp = datetime.now()

        # Clean model name for filename compatibility
        clean_model_name = "".join(
            c for c in model_name if c.isalnum() or c in (" ", "-", "_")
        ).rstrip()

        # Compact timestamp: e.g., 20240602_134217
        timestamp_str = timestamp.strftime("%Y%m%d_%H%M%S")

        return f"{clean_model_name}_{timestamp_str}.txt"

    def save_result(
        self,
        eval_name: Union[str, EvalName],
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        execution_time_seconds: float,
        additional_data: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None,
    ) -> str:
        """
        Save evaluation result to a text file in an evaluation-specific subfolder.

        Args:
            eval_name: Name of the evaluation (EvalName enum or str)
            model_name: Name of the model used
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            execution_time_seconds: Total execution time in seconds
            additional_data: Optional additional data to include
            timestamp: Timestamp for the evaluation (defaults to now)

        Returns:
            Path to the saved result file
        """
        if timestamp is None:
            timestamp = datetime.now()

        eval_subdir = self.get_eval_subdir(eval_name)
        filename = self.generate_result_filename(eval_name, model_name, timestamp)
        filepath = eval_subdir / filename

        # Format execution time
        if execution_time_seconds < 60:
            time_str = f"{execution_time_seconds:.2f} seconds"
        elif execution_time_seconds < 3600:
            minutes = execution_time_seconds / 60
            time_str = f"{minutes:.2f} minutes"
        else:
            hours = execution_time_seconds / 3600
            time_str = f"{hours:.2f} hours"

        # Pretty-print main eval name for header
        eval_label = (
            eval_name.value if isinstance(eval_name, EvalName) else str(eval_name)
        )

        # Create result content
        result_content = f"""EVALUATION RESULT
================

Evaluation Name: {eval_label}
Model: {model_name}
Date: {timestamp.strftime("%Y-%m-%d")}
Time: {timestamp.strftime("%H:%M:%S")}
Input Tokens: {input_tokens:,}
Output Tokens: {output_tokens:,}
Total Tokens: {input_tokens + output_tokens:,}
Execution Time: {time_str}

ADDITIONAL DATA
===============
"""

        # Add additional data if provided
        if additional_data:
            for key, value in additional_data.items():
                if isinstance(value, dict):
                    result_content += f"{key}:\n"
                    for sub_key, sub_value in value.items():
                        result_content += f"  {sub_key}: {sub_value}\n"
                elif isinstance(value, list):
                    result_content += f"{key}:\n"
                    for item in value:
                        result_content += f"  - {item}\n"
                else:
                    result_content += f"{key}: {value}\n"
        else:
            result_content += "None\n"

        # Add summary section
        result_content += f"""
SUMMARY
=======
Evaluation: {eval_label}
Model: {model_name}
Completed: {timestamp.strftime("%Y-%m-%d %H:%M:%S")}
Performance: {input_tokens + output_tokens:,} total tokens in {time_str}
"""

        # Write to file
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(result_content)

        print(f"✅ Result saved to: {filepath}")
        return str(filepath)

    def save_result_json(
        self,
        eval_name: Union[str, EvalName],
        model_name: str,
        input_tokens: int,
        output_tokens: int,
        execution_time_seconds: float,
        additional_data: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None,
    ) -> str:
        """
        Save evaluation result to a JSON file in an evaluation-specific subfolder for programmatic access.

        Args:
            eval_name: Name of the evaluation
            model_name: Name of the model used
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            execution_time_seconds: Total execution time in seconds
            additional_data: Optional additional data to include
            timestamp: Timestamp for the evaluation (defaults to now)

        Returns:
            Path to the saved JSON result file
        """
        if timestamp is None:
            timestamp = datetime.now()

        eval_subdir = self.get_eval_subdir(eval_name)
        # The only difference: use the revised generate_result_filename,
        # which does not include the eval name in the file at all.
        base_filename = self.generate_result_filename(eval_name, model_name, timestamp)
        json_filename = base_filename.replace(".txt", ".json")
        filepath = eval_subdir / json_filename

        eval_label = eval_name.value if isinstance(eval_name, EvalName) else str(eval_name)

        # Create result data structure
        result_data = {
            "evaluation_name": eval_label,
            "model_name": model_name,
            "timestamp": timestamp.isoformat(),
            "date": timestamp.strftime("%Y-%m-%d"),
            "time": timestamp.strftime("%H:%M:%S"),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "execution_time_seconds": execution_time_seconds,
            "execution_time_formatted": self._format_time(execution_time_seconds),
            "additional_data": additional_data or {},
        }

        # Write JSON file
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)

        print(f"✅ JSON result saved to: {filepath}")
        return str(filepath)

    def _format_time(self, seconds: float) -> str:
        """Helper method to format execution time."""
        if seconds < 60:
            return f"{seconds:.2f} seconds"
        elif seconds < 3600:
            minutes = seconds / 60
            return f"{minutes:.2f} minutes"
        else:
            hours = seconds / 3600
            return f"{hours:.2f} hours"

    def list_results(self, eval_name: Optional[Union[str, EvalName]] = None) -> List[str]:
        """
        List all result files for a given evaluation or all if not specified.

        Args:
            eval_name: Optional name of the evaluation or EvalName enum.
        Returns:
            List of result file paths
        """
        result_files = []
        if eval_name is None:
            # All eval subfolders
            for subdir in self.results_dir.iterdir():
                if subdir.is_dir():
                    for file_path in subdir.glob("*.txt"):
                        result_files.append(str(file_path))
        else:
            eval_subdir = self.get_eval_subdir(eval_name)
            for file_path in eval_subdir.glob("*.txt"):
                result_files.append(str(file_path))
        return sorted(result_files)

    def get_latest_result(self, eval_name: Optional[Union[str, EvalName]] = None) -> Optional[str]:
        """
        Get the path to the most recent result file.

        Args:
            eval_name: Optional evaluation name to consider just that subfolder.
        Returns:
            Path to the latest result file, or None if no results exist
        """
        result_files = self.list_results(eval_name=eval_name)
        return result_files[-1] if result_files else None


# Convenience functions for quick result saving
def save_eval_result(
    eval_name: Union[str, EvalName],
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    execution_time_seconds: float,
    additional_data: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Quick function to save an evaluation result.

    Args:
        eval_name: Name of the evaluation (enum or string)
        model_name: Name of the model used
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        execution_time_seconds: Total execution time in seconds
        additional_data: Optional additional data to include

    Returns:
        Path to the saved result file
    """
    result_gen = EvaluationResult()
    return result_gen.save_result(
        eval_name=eval_name,
        model_name=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        execution_time_seconds=execution_time_seconds,
        additional_data=additional_data,
    )


def save_eval_result_json(
    eval_name: Union[str, EvalName],
    model_name: str,
    input_tokens: int,
    output_tokens: int,
    execution_time_seconds: float,
    additional_data: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Quick function to save an evaluation result as JSON.

    Args:
        eval_name: Name of the evaluation (enum or string)
        model_name: Name of the model used
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        execution_time_seconds: Total execution time in seconds
        additional_data: Optional additional data to include

    Returns:
        Path to the saved JSON result file
    """
    result_gen = EvaluationResult()
    return result_gen.save_result_json(
        eval_name=eval_name,
        model_name=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        execution_time_seconds=execution_time_seconds,
        additional_data=additional_data,
    )