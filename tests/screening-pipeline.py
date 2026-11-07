"""Execute the actual embedded screening functions without network or deployment."""
import ast, pathlib, textwrap, unittest, time, math, statistics, urllib.parse
from datetime import datetime, timezone
source=pathlib.Path('.github/workflows/pages.yml').read_text()
block=source.split('      - name: Build dividend and Rocket Radar\n',1)[1].split('      - name:',1)[0]
script=textwrap.dedent(block.split("          python - <<'PY'\n",1)[1].rsplit('          PY',1)[0])
module=ast.parse(script)
functions=[node for node in module.body if isinstance(node,ast.FunctionDef)]
scope=dict(time=time,math=math,statistics=statistics,urllib=urllib,datetime=datetime,timezone=timezone)
exec(compile(ast.Module(body=functions,type_ignores=[]),'actual-screening-functions','exec'),scope)
class Screening(unittest.TestCase):
 def fixture(self):
  now=int(time.time())
  return {'chart':{'result':[{'meta':{'symbol':'SYNTH','currency':'EUR'},'timestamp':[now-86400,now],
   'indicators':{'quote':[{'close':[10,11],'volume':[100,200]}]},'events':{'dividends':{'a':{'amount':1,'date':now-1000}}}}]}}
 def test_invalid_data_is_not_zero(self):
  for value in [None,0,-2,float('nan')]:
   fixture=self.fixture();fixture['chart']['result'][0]['indicators']['quote'][0]['close'][0]=value
   scope['get_json']=lambda url:fixture
   with self.assertRaises(RuntimeError):scope['yahoo_history']('SYNTH')
 def test_exact_identity(self):
  fixture=self.fixture();scope['get_json']=lambda url:fixture
  with self.assertRaises(RuntimeError):scope['yahoo_history']('OTHER')
 def test_dividend_currency(self):
  fixture=self.fixture();fixture['chart']['result'][0]['events']['dividends']['a']['currency']='USD'
  scope['get_json']=lambda url:fixture
  with self.assertRaises(RuntimeError):scope['yahoo_history']('SYNTH')
 def test_missing_events_not_scored_as_zero(self):
  old=scope['yahoo_history'];now=int(time.time());rows=[(now-(399-i)*86400,100+i,1000) for i in range(400)]
  try:
   scope['yahoo_history']=lambda *args:(rows,[])
   with self.assertRaises(RuntimeError):scope['dividend_score']('SYNTH','Synthetic','test')
   scope['yahoo_history']=lambda *args:(rows,[(now-10000,2)])
   result=scope['dividend_score']('SYNTH','Synthetic','test')
   self.assertGreater(result['yield_pct'],0);self.assertIn('observed_at',result)
  finally:scope['yahoo_history']=old
 def test_exact_year_boundary_uses_252_observations(self):
  old=scope['yahoo_history'];now=int(time.time())
  rows=[(now-(252-i)*2*86400,100+i,1000) for i in range(253)]
  try:
   scope['yahoo_history']=lambda *args:(rows,[(now-10000,2)])
   result=scope['dividend_score']('SYNTH','Synthetic','test')
   self.assertEqual(result['return_12m'],252.0)
  finally:scope['yahoo_history']=old
unittest.main()
