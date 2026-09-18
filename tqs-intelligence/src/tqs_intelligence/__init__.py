"""TQS Platform local intelligence and research engine."""

__version__ = "0.9.1"

# Keep the broad source module stable while transparently upgrading MOEX semantics.
# This avoids corrupting live/history data when ISS CHANGE/LASTCHANGE represents
# absolute index points rather than percentage change.
from . import sources as _sources
from .moex_source import MoexSourceV04

_sources.MoexSource = MoexSourceV04
