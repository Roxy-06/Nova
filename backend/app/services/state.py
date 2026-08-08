class ScanStateTracker:
    def __init__(self):
        self.active_source_url: str | None = None
        self.scan_status: str = "idle"
        self.chunks_processed: int = 0

_states: dict[str, ScanStateTracker] = {}

def get_scan_state(agent_id: str) -> ScanStateTracker:
    if agent_id not in _states:
        _states[agent_id] = ScanStateTracker()
    return _states[agent_id]
