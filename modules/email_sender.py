import smtplib
import imaplib
import io
import os
import re
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from email.utils import formatdate, make_msgid

# ── SerpHawk logo (used in every HTML email) ────────────────────────────────
_logo_lock = threading.Lock()
_logo_bytes_cache = None
_LOGO_FILENAME = "Serp Hwak Logo.png"


def _serphawk_logo_bytes():
    """Load + resize the SerpHawk logo from the project folder, cached, as PNG bytes."""
    global _logo_bytes_cache
    if _logo_bytes_cache is not None:
        return _logo_bytes_cache
    with _logo_lock:
        if _logo_bytes_cache is not None:
            return _logo_bytes_cache
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(project_root, _LOGO_FILENAME)
        try:
            from PIL import Image, ImageChops
            with Image.open(path) as im:
                im = im.convert("RGB")
                bg = Image.new("RGB", im.size, (252, 252, 252))
                bbox = ImageChops.difference(im, bg).getbbox()
                if bbox:
                    im = im.crop(bbox)
                w, h = im.size
                target = 170
                scale = min(1.0, target / max(w, h))
                if scale < 1.0:
                    im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
                buf = io.BytesIO()
                im.save(buf, format="PNG", optimize=True)
                _logo_bytes_cache = buf.getvalue()
        except Exception as e:
            print(f"[SerpHawk logo load failed] {e}")
            _logo_bytes_cache = None
    return _logo_bytes_cache


def _logo_img_html(alt="SERP Hawk"):
    return (
        f'<img src="cid:serphawk_logo" alt="{alt}" width="150" height="150" '
        'style="display:block;width:150px;height:150px;border-radius:12px;background:#ffffff;padding:4px;box-sizing:border-box" />'
    )


def _inject_logo(html):
    """Insert the SerpHawk logo into an HTML email body."""
    if "cid:serphawk_logo" in html:
        return html
    img = _logo_img_html()
    replacements = [
        ('<strong style="font-size:18px">🦅 SERP Hawk CRM</strong>', img),
        ('<strong style="font-size:18px">🦅 SERP Hawk Supplier Portal</strong>', _logo_img_html("SERP Hawk Supplier Portal")),
        ('<strong style="font-size:18px">SerpHawk CRM</strong>', img),
        ('<p style="margin:0;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#93c5fd">SerpHawk CRM</p>', img),
    ]
    for old, new in replacements:
        if old in html:
            return html.replace(old, new)
    block = f'<div style="text-align:center;background:#ffffff;padding:18px 18px 4px">{img}</div>'
    m = re.search(r"(<body[^>]*>)", html, re.I)
    if m:
        return html[: m.end()] + block + html[m.end():]
    return block + html

# Folder names (by provider) where a copy of the sent mail is archived via IMAP.
_ARCHIVE_FOLDERS = [
    "INBOX",               # store outgoing copies in the account's Inbox (default)
    "[Gmail]/Sent Mail",   # Gmail fallback
    "Sent Items",          # Outlook / Microsoft 365 fallback
    "Sent",                # generic IMAP fallback
    "INBOX.Sent",          # other generic IMAP fallback
    "INBOX.Sent Items",
]

def _archive_sent_copy(msg, sender_email, sender_password, smtp_server, imap_server=None):
    """Append a copy of the sent message into the account's mailbox via IMAP.
    Copies land in the account's Inbox (per requirement); falls back to the
    provider's Sent folder if the Inbox is not writable.
    Best-effort: never raises — send must not fail because archiving failed."""
    # Derive the IMAP host from the SMTP host (smtp.gmail.com -> imap.gmail.com,
    # mail.host.com -> mail.host.com) unless a dedicated server is configured.
    if not imap_server and smtp_server:
        imap_server = smtp_server.replace("smtp.", "imap.", 1) if smtp_server.startswith("smtp.") else smtp_server
    if not imap_server:
        return
    try:
        try:
            conn = imaplib.IMAP4_SSL(imap_server, timeout=30)
        except Exception:
            conn = imaplib.IMAP4(imap_server, timeout=30)
        conn.login(sender_email, sender_password)
        for folder in _ARCHIVE_FOLDERS:
            try:
                typ, _ = conn.select(f'"{folder}"', readonly=True)
            except Exception:
                continue
            if typ == "OK":
                conn.append(f'"{folder}"', None, None, msg.as_bytes())
                break
        conn.logout()
    except Exception as e:
        print(f"[Sent-copy archive failed] {e}")


def send_email_outlook(
    to_email: str,
    subject: str,
    body: str,
    sender_email: str,
    sender_password: str,
    smtp_server: str = "smtp.gmail.com",
    smtp_port: int = 587,
    imap_server: str = None,
    attachments: list = None,
):
    """
    Send an email over SMTP (supports STARTTLS on 587, falls back to implicit TLS on 465).

    `body` may contain plain text or HTML. If it starts with '<' it is sent as HTML.
    `attachments` is an optional list of (filename, bytes, mime_type) tuples attached to the mail.
    After sending, a copy is archived into the account's Inbox (falling back to the
    "Sent" folder) over IMAP so the sent mail stays stored in the sender's mailbox. If
    `imap_server` is not provided it is derived from `smtp_server`.
    """
    msg = MIMEMultipart("mixed")
    msg["From"] = sender_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid()

    is_html = isinstance(body, str) and body.lstrip().startswith("<")

    if is_html:
        logo_bytes = _serphawk_logo_bytes()
        if logo_bytes:
            body = _inject_logo(body)
            body_part = MIMEText(body, "html")
            related = MIMEMultipart("related")
            related.attach(body_part)
            img_part = MIMEBase("image", "png")
            img_part.set_payload(logo_bytes)
            encoders.encode_base64(img_part)
            img_part.add_header("Content-ID", "<serphawk_logo>")
            img_part.add_header("Content-Disposition", "inline", filename="serphawk_logo.png")
            related.attach(img_part)
            msg.attach(related)
        else:
            msg.attach(MIMEText(body, "html"))
    else:
        msg.attach(MIMEText(body, "plain"))

    for filename, data, mime_type in (attachments or []):
        part = MIMEBase(*mime_type.split("/", 1))
        part.set_payload(data)
        encoders.encode_base64(part)
        part.add_header("Content-Disposition", "attachment", filename=filename)
        msg.attach(part)

    sent_success = False
    if str(smtp_port) == "465":
        with smtplib.SMTP_SSL(smtp_server, int(smtp_port), timeout=20) as server:
            server.login(sender_email, sender_password)
            server.send_message(msg)
        sent_success = True
    else:
        with smtplib.SMTP(smtp_server, int(smtp_port), timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        sent_success = True

    if sent_success:
        # Keep a copy of the sent mail in the account's Inbox / Sent mailbox (Gmail/Outlook/etc.)
        _archive_sent_copy(msg, sender_email, sender_password, smtp_server, imap_server)


def send_password_reset_email(to_email: str, reset_url: str):
    """Send a branded password-reset link. Best-effort: returns True on success."""
    sender = __import__("os").environ.get("EMAIL_SENDER") or __import__("os").environ.get("OUTLOOK_EMAIL") or ""
    password = __import__("os").environ.get("EMAIL_PASSWORD") or __import__("os").environ.get("OUTLOOK_PASSWORD") or ""
    smtp_server = __import__("os").environ.get("EMAIL_HOST") or __import__("os").environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = __import__("os").environ.get("EMAIL_PORT") or __import__("os").environ.get("SMTP_PORT", 587)
    if not sender or not password:
        return False
    subject = "Reset your SERP Hawk CRM password"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#1e293b;color:#fff;padding:22px 28px">
        <strong style="font-size:18px">🦅 SERP Hawk CRM</strong>
      </div>
      <div style="padding:28px">
        <h2 style="color:#0f172a;font-size:20px;margin:0 0 12px">Reset your password</h2>
        <p style="color:#475569;line-height:1.6;margin:0 0 20px">We received a request to reset the password for your account. Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="{reset_url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:600">Set a new password</a>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:20px 0 0">If you did not request this, you can safely ignore this email. The link may only be used once.</p>
        <p style="color:#94a3b8;font-size:11px;line-height:1.5;margin:16px 0 0;border-top:1px solid #e2e8f0;padding-top:12px">📬 Didn't see this in your inbox? Sometimes automated emails land in spam or junk — please check there and mark us as "Not spam" so future emails reach you.</p>
      </div>
    </div>
    """
    try:
        send_email_outlook(
            to_email=to_email,
            subject=subject,
            body=html,
            sender_email=sender,
            sender_password=password,
            smtp_server=smtp_server,
            smtp_port=smtp_port,
        )
        return True
    except Exception as e:
        print(f"[Password reset email failed] {e}")
        return False


def send_otp_email(to_email: str, otp_code: str, purpose: str = "email verification"):
    """Send a branded OTP code email. Best-effort: returns True on success."""
    import os
    sender = os.environ.get("EMAIL_SENDER") or os.environ.get("OUTLOOK_EMAIL") or ""
    password = os.environ.get("EMAIL_PASSWORD") or os.environ.get("OUTLOOK_PASSWORD") or ""
    smtp_server = os.environ.get("EMAIL_HOST") or os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = os.environ.get("EMAIL_PORT") or os.environ.get("SMTP_PORT", 587)
    if not sender or not password:
        return False
    subject = f"Your SERP Hawk CRM verification code: {otp_code}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#1e293b;color:#fff;padding:22px 28px">
        <strong style="font-size:18px">🦅 SERP Hawk CRM</strong>
      </div>
      <div style="padding:28px">
        <h2 style="color:#0f172a;font-size:20px;margin:0 0 12px">Verify your email address</h2>
        <p style="color:#475569;line-height:1.6;margin:0 0 20px">Use the code below to complete your {purpose}. This code expires in <strong>10 minutes</strong>.</p>
        <div style="background:#f1f5f9;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px">
          <span style="font-size:32px;font-weight:800;letter-spacing:6px;color:#1e293b">{otp_code}</span>
        </div>
        <p style="color:#64748b;font-size:13px;line-height:1.6;margin:20px 0 0">If you did not request this, you can safely ignore this email.</p>
        <p style="color:#94a3b8;font-size:11px;line-height:1.5;margin:16px 0 0;border-top:1px solid #e2e8f0;padding-top:12px">📬 Didn't see this in your inbox? Sometimes automated emails land in spam or junk — please check there and mark us as "Not spam" so future emails reach you.</p>
      </div>
    </div>
    """
    try:
        send_email_outlook(
            to_email=to_email,
            subject=subject,
            body=html,
            sender_email=sender,
            sender_password=password,
            smtp_server=smtp_server,
            smtp_port=smtp_port,
        )
        return True
    except Exception as e:
        print(f"[OTP email failed] {e}")
        return False