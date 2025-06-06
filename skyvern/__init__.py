from ddtrace import tracer
from ddtrace.filters import FilterRequestsOnUrl

from skyvern.forge.sdk.forge_log import setup_logger

tracer.configure(
    settings={
        "FILTERS": [
            FilterRequestsOnUrl(r"http://.*/heartbeat$"),
        ],
    },
)
setup_logger()


from skyvern.forge import app  # noqa: E402, F401
from skyvern.library import Skyvern  # noqa: E402

__all__ = ["Skyvern"]
