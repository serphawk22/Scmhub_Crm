import json
import os

new_en_auth = {
  "pw_very_weak": "Very Weak",
  "pw_weak": "Weak",
  "pw_fair": "Fair",
  "pw_good": "Good",
  "pw_strong": "Strong",
  "pw_8": "At least 8 characters",
  "pw_12": "At least 12 characters",
  "pw_upper": "One uppercase letter",
  "pw_lower": "One lowercase letter",
  "pw_number": "One number",
  "pw_special": "One special character",
  "otp_send_failed": "Failed to send OTP.",
  "otp_network": "Network error while verifying OTP.",
  "otp_invalid": "Invalid OTP code.",
  "otp_email_verified": "Email Verified",
  "otp_email_verified_desc": "Your email address ({{email}}) has been successfully verified. You can now proceed.",
  "otp_title": "Verify your email",
  "otp_desc_prefix": "We sent a 6-digit code to",
  "otp_sending": "Sending...",
  "otp_send": "Send Code",
  "otp_enter": "Enter the 6-digit code",
  "otp_debug_title": "Development Mode",
  "otp_debug_desc": "Code is:",
  "otp_verifying": "Verifying...",
  "otp_resend_in": "Resend code in {{seconds}}s",
  "otp_resend": "Resend Code",
  "otp_cancel": "Cancel"
}

new_es_auth = {
  "pw_very_weak": "Muy Débil",
  "pw_weak": "Débil",
  "pw_fair": "Aceptable",
  "pw_good": "Buena",
  "pw_strong": "Fuerte",
  "pw_8": "Al menos 8 caracteres",
  "pw_12": "Al menos 12 caracteres",
  "pw_upper": "Una letra mayúscula",
  "pw_lower": "Una letra minúscula",
  "pw_number": "Un número",
  "pw_special": "Un carácter especial",
  "otp_send_failed": "Error al enviar OTP.",
  "otp_network": "Error de red al verificar OTP.",
  "otp_invalid": "Código OTP inválido.",
  "otp_email_verified": "Correo Verificado",
  "otp_email_verified_desc": "Tu dirección de correo ({{email}}) ha sido verificada. Puedes continuar.",
  "otp_title": "Verifica tu correo",
  "otp_desc_prefix": "Enviamos un código de 6 dígitos a",
  "otp_sending": "Enviando...",
  "otp_send": "Enviar Código",
  "otp_enter": "Ingresa el código de 6 dígitos",
  "otp_debug_title": "Modo Desarrollo",
  "otp_debug_desc": "El código es:",
  "otp_verifying": "Verificando...",
  "otp_resend_in": "Reenviar en {{seconds}}s",
  "otp_resend": "Reenviar Código",
  "otp_cancel": "Cancelar"
}

def update_file(filepath, new_dict):
    if not os.path.exists(filepath):
        print(f"Not found: {filepath}")
        return
    with open(filepath, 'r') as f:
        data = json.load(f)
        
    if "auth" not in data:
        data["auth"] = {}
        
    data["auth"].update(new_dict)
    
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

update_file('frontend/src/translations/en.json', new_en_auth)
update_file('frontend/src/translations/es.json', new_es_auth)

print("Additional translations updated!")
