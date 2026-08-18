import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth";
import { useToast } from "../components/toast";

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const pinRefs = [useRef(), useRef(), useRef(), useRef()];
  const phoneRef = useRef();

  useEffect(() => { phoneRef.current?.focus(); }, []);

  const handlePhoneChange = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    setPhone(digits);
    if (digits.length === 8) {
      pinRefs[0].current?.focus();
    }
  };

  const handlePinChange = (index, val) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    if (digit && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
    if (index === 3 && digit) {
      const pinStr = newPin.join("");
      if (phone.length === 8 && pinStr.length === 4) {
        doLogin(phone, pinStr);
      }
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handlePinPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!text) return;
    const newPin = [...pin];
    for (let i = 0; i < 4; i++) {
      newPin[i] = text[i] || "";
    }
    setPin(newPin);
    const focusIdx = Math.min(text.length, 3);
    pinRefs[focusIdx].current?.focus();
    if (text.length === 4 && phone.length === 8) {
      doLogin(phone, text);
    }
  };

  const doLogin = async (ph, pi) => {
    setLoading(true);
    try {
      await login(ph, pi);
    } catch (err) {
      toast.error(err.message?.includes("network") ? t("login.network") : t("login.error"));
      setPin(["", "", "", ""]);
      pinRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const pinStr = pin.join("");
    if (phone.length >= 1 && pinStr.length >= 1) {
      doLogin(phone, pinStr);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/logousigne.png" alt="Logo" className="login-logo" />
        <h1 className="login-title">ERP Manager</h1>
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>{t("login.phone")}</label>
            <input
              ref={phoneRef}
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="22222222"
              maxLength={8}
              autoComplete="tel"
            />
            <span className="input-hint">{phone.length}/8</span>
          </div>
          <div className="input-group">
            <label>{t("login.pin")}</label>
            <div className="pin-inputs">
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  className="pin-input"
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  onPaste={handlePinPaste}
                  maxLength={1}
                  autoComplete={i === 0 ? "current-password" : "one-time-code"}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary login-btn" disabled={loading || !phone || pin.join("").length === 0}>
            {loading ? t("app.loading") : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
