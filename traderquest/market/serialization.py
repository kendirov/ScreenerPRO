from dataclasses import fields, is_dataclass
from decimal import Decimal
from enum import Enum

def to_primitive(value):
    if isinstance(value, Decimal): return str(value)
    if isinstance(value, Enum): return value.value
    if is_dataclass(value): return {f.name: to_primitive(getattr(value, f.name)) for f in fields(value)}
    if isinstance(value, (tuple, list)): return [to_primitive(v) for v in value]
    if isinstance(value, dict): return {str(k): to_primitive(v) for k, v in value.items()}
    return value

def event_to_dict(envelope): return to_primitive(envelope)
