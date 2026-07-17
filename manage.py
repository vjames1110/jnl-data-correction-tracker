#!/usr/bin/env python
"""Repository-root wrapper for backend Django management commands."""
import os
import sys
from pathlib import Path


def main():
    backend_dir = Path(__file__).resolve().parent / "backend"
    sys.path.insert(0, str(backend_dir))
    os.chdir(backend_dir)
    os.environ.setdefault(
        "DJANGO_SETTINGS_MODULE",
        "config.settings.production",
    )

    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
