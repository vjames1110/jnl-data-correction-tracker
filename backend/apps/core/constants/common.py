from enum import Enum


class EnvironmentName(str, Enum):
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging"
    PRODUCTION = "production"


class SortDirection(str, Enum):
    ASCENDING = "asc"
    DESCENDING = "desc"


DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

API_VERSION = "v1"
APPLICATION_NAME = "JNL Approval Management System"
COMPANY_NAME = "Jhajharia Nirman Limited"