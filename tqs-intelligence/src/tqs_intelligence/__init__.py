"""TQS Platform local intelligence and research engine."""

__version__ = "0.13.15"

# Keep the broad source module stable while transparently upgrading MOEX semantics.
# This avoids corrupting live/history data when ISS CHANGE/LASTCHANGE represents
# absolute index points rather than percentage change.
from . import sources as _sources
from .moex_source import MoexSourceV04

_sources.MoexSource = MoexSourceV04

[executed on device: Kendirov (dbeba00d-0e72-4d4e-b51c-17d1d4fb9e1f)]