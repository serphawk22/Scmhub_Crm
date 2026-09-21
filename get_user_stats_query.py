import sys
import json

code = """
@app.get("/users/{user_id}/stats")
def get_user_stats(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    stats = {}
    
    # Dev stats
    if user.role in ["ProjectMember", "Intern"]:
        # Query ProjectTicket for tickets assigned to this user
        # We don't have assigned_to on ProjectTicket, we have current_owner which is a string? Let's check ProjectTicket
        pass
"""

print(code)
