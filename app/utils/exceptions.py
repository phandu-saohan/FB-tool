class FacebookAutomationException(Exception):
    def __init__(self, message: str = ''):
        super().__init__(message)
        self.message = message

class FacebookLoginRequired(FacebookAutomationException):
    pass

class FacebookCheckpointDetected(FacebookAutomationException):
    pass

class FacebookPostFailed(FacebookAutomationException):
    pass

class BrowserSessionError(FacebookAutomationException):
    pass

class DatabaseError(FacebookAutomationException):
    pass
