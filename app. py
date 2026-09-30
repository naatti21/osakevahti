import streamlit as st
import yfinance as yf
import pandas as pd
import plotly.express as px
import os

# --- Sivun perusasetukset ---
st.set_page_config(
    page_title="AI Salkkuvahti & Sparraaja",
    page_icon="📈",
    layout="wide"
)

PORTFOLIO_FILE = "portfolio.csv"

# --- Tiedostonhallinta (CSV) ---
def load_portfolio():
    if os.path.exists(PORTFOLIO_FILE):
        return pd.read_csv(PORTFOLIO_FILE)
    else:
        # Esimerkkidata ensimmäistä käynnistystä varten
        initial_data = pd.DataFrame([
            {"ticker": "FORTUM.HE", "shares": 120, "buy_price": 12.80},
            {"ticker": "NESTE.HE", "shares": 45, "buy_price": 26.50},
            {"ticker": "NDA-FI.HE", "shares": 180, "buy_price": 10.40},
        ])
        initial_data.to_csv(PORTFOLIO_FILE, index=False)
        return initial_data

def save_portfolio(df):
    df.to_csv(PORTFOLIO_FILE, index=False)

# --- Markkinadatan haku ---
@st.cache_data(ttl=300)  # Välimuisti 5 minuuttia, nopeuttaa käyttöä
def fetch_market_data(tickers):
    data = {}
    for t in tickers:
        try:
            stock = yf.Ticker(t)
            hist = stock.history(period="5d")
            
            if not hist.empty:
                price = float(hist['Close'].iloc[-1])
            else:
                price = float(stock.fast_info.get('lastPrice', 0.0))
            
            info = stock.info or {}
            sector = info.get('sector', 'Ei toimialaa')
            short_name = info.get('shortName', t)
            div_yield = info.get('dividendYield', 0.0)
            
            # Normalisoidaan osinkotuotto prosentiksi
            if div_yield is not None:
                div_yield = div_yield * 100 if div_yield < 1 else div_yield
            else:
                div_yield = 0.0
                
            data[t] = {
                "name": short_name,
                "current_price": price,
                "sector": sector,
                "div_yield": float(div_yield)
            }
        except Exception:
            data[t] = {
                "name": t,
                "current_price": 0.0,
                "sector": "Tuntematon",
                "div_yield": 0.0
            }
    return data

# --- Gemini API -kutsut ---
def ask_gemini(api_key, system_context, user_prompt):
    """Kutsuu Gemini API:a hyödyntäen joko uutta google-genai tai vanhempaa google-generativeai -kirjastoa."""
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        full_content = f"{system_context}\n\nKäyttäjän toimeksianto / kysymys:\n{user_prompt}"
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_content
        )
        return response.text
    except ImportError:
        try:
            import google.generativeai as genai_old
            genai_old.configure(api_key=api_key)
            model = genai_old.GenerativeModel("gemini-1.5-flash")
            full_content = f"{system_context}\n\nKäyttäjän toimeksianto / kysymys:\n{user_prompt}"
            response = model.generate_content(full_content)
            return response.text
        except Exception as e:
            return f"Virhe Gemini-kutsussa: {e}. Varmista että 'google-genai' on asennettu."
    except Exception as e:
        return f"Virhe API-kutsussa: {e}"

# --- Alustetaan data ---
df_saved = load_portfolio()
tickers = df_saved['ticker'].tolist()
market_data = fetch_market_data(tickers)

# Lasketaan salkun arvot ja tuotot
portfolio_rows = []
for _, row in df_saved.iterrows():
    t = row['ticker']
    shares = float(row['shares'])
    buy_p = float(row['buy_price'])
    m_info = market_data.get(t, {"name": t, "current_price": 0.0, "sector": "Tuntematon", "div_yield": 0.0})
    
    curr_p = m_info["current_price"]
    cost = shares * buy_p
    val = shares * curr_p
    profit = val - cost
    profit_pct = (profit / cost * 100) if cost > 0 else 0.0
    est_annual_div = val * (m_info["div_yield"] / 100.0)
    
    portfolio_rows.append({
        "Tikkeri": t,
        "Nimi": m_info["name"],
        "Kpl": shares,
        "Hankintahinta (€)": buy_p,
        "Nykykurssi (€)": curr_p,
        "Markkina-arvo (€)": val,
        "Tuotto (€)": profit,
        "Tuotto (%)": profit_pct,
        "Toimiala": m_info["sector"],
        "Osinkotuotto (%)": m_info["div_yield"],
        "Arvioitu osinko (€/v)": est_annual_div
    })

df_calc = pd.DataFrame(portfolio_rows)

total_portfolio_value = df_calc["Markkina-arvo (€)"].sum()
total_portfolio_cost = (df_calc["Kpl"] * df_calc["Hankintahinta (€)"]).sum()
total_profit_eur = total_portfolio_value - total_portfolio_cost
total_profit_pct = (total_profit_eur / total_portfolio_cost * 100) if total_portfolio_cost > 0 else 0.0
total_annual_div = df_calc["Arvioitu osinko (€/v)"].sum()

# --- SIVUPALKKI (Sidebar) ---
with st.sidebar:
    st.header("🔑 Tekoälyn asetukset")
    api_key_input = st.text_input(
        "Gemini API -avain",
        type="password",
        value=os.environ.get("GEMINI_API_KEY", ""),
        help="Hanki ilmainen avain osoitteesta aistudio.google.com"
    )
    
    st.markdown("---")
    st.header("➕ Lisää / Päivitä positio")
    with st.form("add_stock_form", clear_on_submit=True):
        f_ticker = st.text_input("Tikkeri (esim. FORTUM.HE tai AAPL)").strip().upper()
        f_shares = st.number_input("Kpl-määrä", min_value=0.01, step=1.0)
        f_price = st.number_input("Keskihankintahinta (€ / kpl)", min_value=0.01, step=0.1)
        submit_add = st.form_submit_button("Tallenna salkkuun")
        
        if submit_add and f_ticker:
            if f_ticker in df_saved['ticker'].values:
                df_saved.loc[df_saved['ticker'] == f_ticker, ['shares', 'buy_price']] = [f_shares, f_price]
            else:
                new_row = pd.DataFrame([{"ticker": f_ticker, "shares": f_shares, "buy_price": f_price}])
                df_saved = pd.concat([df_saved, new_row], ignore_index=True)
            save_portfolio(df_saved)
            st.cache_data.clear()
            st.rerun()

    st.markdown("---")
    st.header("🗑️ Poista omistus")
    if not df_saved.empty:
        stock_to_delete = st.selectbox("Valitse poistettava osake", df_saved['ticker'].tolist())
        if st.button("Poista valittu"):
            df_saved = df_saved[df_saved['ticker'] != stock_to_delete]
            save_portfolio(df_saved)
            st.cache_data.clear()
            st.rerun()

# --- PÄÄNÄKYMÄ ---
st.title("📈 AI Salkkuvahti & Sparraaja")

tab1, tab2 = st.tabs(["📊 Salkun Yhteenveto", "🤖 Tekoälysparraaja"])

with tab1:
    # Tunnuslukukortit
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Salkun arvo", f"{total_portfolio_value:,.2f} €")
    col2.metric("Kokonaiskustannus", f"{total_portfolio_cost:,.2f} €")
    col3.metric("Kokonaistuotto", f"{total_profit_eur:,.2f} €", f"{total_profit_pct:.2f} %")
    col4.metric("Arvioitu vuosiosinko", f"{total_annual_div:,.2f} €", f"{(total_annual_div/total_portfolio_value*100 if total_portfolio_value>0 else 0):.2f} %")
    
    st.markdown("### Nykyiset omistukset")
    st.dataframe(
        df_calc.style.format({
            "Kpl": "{:.1f}",
            "Hankintahinta (€)": "{:.2f} €",
            "Nykykurssi (€)": "{:.2f} €",
            "Markkina-arvo (€)": "{:.2f} €",
            "Tuotto (€)": "{:+.2f} €",
            "Tuotto (%)": "{:+.2f} %",
            "Osinkotuotto (%)": "{:.2f} %",
            "Arvioitu osinko (€/v)": "{:.2f} €"
        }),
        use_container_width=True
    )

    # Graafit
    st.markdown("---")
    g_col1, g_col2 = st.columns(2)
    
    with g_col1:
        st.subheader("Salkun toimialajakauma")
        if total_portfolio_value > 0:
            fig_sector = px.pie(
                df_calc, 
                values="Markkina-arvo (€)", 
                names="Toimiala", 
                hole=0.45,
                color_discrete_sequence=px.colors.qualitative.Safe
            )
            fig_sector.update_traces(textposition='inside', textinfo='percent+label')
            st.plotly_chart(fig_sector, use_container_width=True)
            
    with g_col2:
        st.subheader("Tuotto per osake (%)")
        if not df_calc.empty:
            df_calc["Väri"] = df_calc["Tuotto (%)"].apply(lambda x: "Plussalla" if x >= 0 else "Miinuksella")
            fig_returns = px.bar(
                df_calc, 
                x="Tikkeri", 
                y="Tuotto (%)", 
                color="Väri",
                color_discrete_map={"Plussalla": "#2ca02c", "Miinuksella": "#d62728"}
            )
            st.plotly_chart(fig_returns, use_container_width=True)

with tab2:
    st.header("Tekoälyanalyytikko & Salkkusparraaja")
    st.caption("Sparraaja tuntee salkkusi nykyisen allokaation ja analysoi sitä reaaliajassa.")

    # Rakennetaan tekoälylle automaattinen tilannekuva salkusta
    summary_text = f"""
SALKUN TÄMÄNHETKINEN TILANNE:
- Kokonaisarvo: {total_portfolio_value:.2f} €
- Kokonaistuotto: {total_profit_eur:.2f} € ({total_profit_pct:.2f} %)
- Vuotuinen arvioitu osinkovirta: {total_annual_div:.2f} €

OMISTUKSET:
"""
    for _, r in df_calc.iterrows():
        summary_text += f"- {r['Tikkeri']} ({r['Nimi']}): {r['Kpl']} kpl | Markkina-arvo: {r['Markkina-arvo (€)']:.2f} € | Tuotto: {r['Tuotto (%)']:.2f} % | Toimiala: {r['Toimiala']} | Osinkotuotto: {r['Osinkotuotto (%)']:.2f} %\n"

    system_context = f"""Toimit kokeneena, analyyttisenä ja terävänä sijoitusstrategina ja sparrauskumppanina.
Alla on käyttäjän salkun reaaliaikaiset tiedot ja markkina-arvot:
{summary_text}

Toimintaohjeet:
1. Ole rehellinen, suorapuheinen ja analyyttinen ("Devil's advocate"). Nosta esiin sokeat pisteet, ylipainotukset ja riskit.
2. Havainnoi toimialojen syklisyyttä, osinkojen kestävyyttä ja korkoympäristön vaikutusta salkun yhtiöihin.
3. Anna perusteltuja kehitysideoita ja hajautusehdotuksia.
4. Vastaa aina suomeksi, selkeästi jäsennettynä (käytä väliotsikoita ja luetteloita)."""

    if not api_key_input:
        st.warning("⚠️ Syötä Gemini API -avain sivupalkkiin aktivoidaksesi sparraajan.")

    # Pikanapit nopeisiin analyyseihin
    st.markdown("#### Pika-analyysit")
    b_col1, b_col2, b_col3 = st.columns(3)
    quick_prompt = None
    
    if b_col1.button("⚠️ Analysoi riskit & haavoittuvuudet"):
        quick_prompt = "Tee salkustani armoton riskianalyysi. Missä ovat suurimmat keskittymä- ja toimialariskit, ja mikä markkinatilanne satuttaisi tätä salkkua eniten?"
    if b_col2.button("💰 Arvioi osinkojen kestävyys"):
        quick_prompt = "Analysoi salkkuni osinkovirtaa. Ovatko näiden yhtiöiden osinkotuotot turvallisella pohjalla ja miten tuloskunto tukee osingonjakoa?"
    if b_col3.button("⚖️ Ehdota hajautusta seuraaviin ostoihin"):
        quick_prompt = "Mitä omaisuusluokkia tai toimialoja minun tulisi harkita seuraavaksi salkun tasapainottamiseksi ja riskin hajauttamiseksi?"

    # Chat-keskusteluhistoria
    if "messages" not in st.session_state:
        st.session_state.messages = []

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Käsitellään pikanapin painallus tai tekstikenttä
    user_input = st.chat_input("Esitä kysymys salkustasi...")
    target_prompt = quick_prompt if quick_prompt else user_input

    if target_prompt:
        if not api_key_input:
            st.error("Lisää API-avain sivupalkkiin ensin.")
        else:
            st.session_state.messages.append({"role": "user", "content": target_prompt})
            with st.chat_message("user"):
                st.markdown(target_prompt)

            with st.chat_message("assistant"):
                with st.spinner("Analysoidaan salkkua..."):
                    reply = ask_gemini(api_key_input, system_context, target_prompt)
                    st.markdown(reply)
                    st.session_state.messages.append({"role": "assistant", "content": reply})
