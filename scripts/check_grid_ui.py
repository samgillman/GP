"""Isolated browser checks for the virtual spreadsheet and keyboard/selection behavior."""
from playwright.sync_api import sync_playwright, expect
import json,time,os,sys
from pathlib import Path
out=Path(os.environ.get('GP_GRID_EVIDENCE', '/tmp/gp-grid-ui')); out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path=os.environ.get('GP_CHROMIUM'),headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8001')
 page.wait_for_selector('.data-grid-viewport')
 page.wait_for_function("localStorage.getItem('gp.workbook.v2') !== null")
 # Regression checks use the small default table before the capacity fixture.
 def gc(r,c):return page.locator(f'input[data-row="{r}"][data-column="{c}"]')
 def paste_range(text):
  page.evaluate('''text=>{const data=new DataTransfer();data.setData('text/plain',text);document.activeElement.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))}''',text)
 def selected_copy():
  return page.evaluate('''()=>{const input=document.querySelector('.data-grid-cell.is-active input');input.focus({preventScroll:true});const data=new DataTransfer();input.dispatchEvent(new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true}));return data.getData('text/plain')}''')
 def go_graph_and_back():
  page.locator('.sheet-navigator').get_by_title('Treatment response study graph',exact=True).click()
  page.locator('.sheet-navigator').get_by_title('Treatment response study',exact=True).click()
 gc(0,0).click();gc(1,1).click(modifiers=['Shift'])
 page.keyboard.press('Delete');expect(gc(0,0)).to_have_value('');expect(gc(1,1)).to_have_value('')
 page.keyboard.press('Control+z');expect(gc(0,0)).to_have_value('42');expect(gc(1,1)).to_have_value('62')
 page.keyboard.press('Meta+Shift+z');expect(gc(0,0)).to_have_value('');expect(gc(1,1)).to_have_value('')
 page.keyboard.press('Meta+z');expect(gc(0,0)).to_have_value('42');expect(gc(1,1)).to_have_value('62')
 paste_range('11\t12\r\n13\t14');expect(gc(0,0)).to_have_value('11');expect(gc(1,1)).to_have_value('14')
 page.keyboard.press('Meta+z');expect(gc(0,0)).to_have_value('42');expect(gc(1,1)).to_have_value('62')
 page.keyboard.press('Control+y');expect(gc(0,0)).to_have_value('11');expect(gc(1,1)).to_have_value('14')
 page.keyboard.press('Control+z');expect(gc(0,0)).to_have_value('42');expect(gc(1,1)).to_have_value('62')
 # Caret editing continues to use native text undo instead of workbook routing.
 gc(0,0).dblclick();page.keyboard.press('End');page.keyboard.type('9');expect(gc(0,0)).to_have_value('429')
 page.evaluate('''()=>{document.activeElement.addEventListener('keydown',event=>{if(event.key==='z')queueMicrotask(()=>window.gridUndoPrevented=event.defaultPrevented)})}''')
 page.keyboard.press('Control+z');expect(gc(0,0)).to_have_value('42');assert page.evaluate('window.gridUndoPrevented') is False
 page.keyboard.press('Escape')
 # Restored range, active cell and selection anchor survive graph navigation.
 gc(0,0).click();gc(2,1).click(modifiers=['Shift']);copied_before=selected_copy();go_graph_and_back()
 assert page.locator('td[aria-selected="true"]').count()==6
 assert page.locator('.data-grid-cell.is-active input').get_attribute('data-row')=='2'
 assert page.locator('.data-grid-cell.is-active input').get_attribute('data-column')=='1'
 assert selected_copy()==copied_before
 page.keyboard.press('Shift+ArrowDown');assert page.locator('td[aria-selected="true"]').count()==8
 page.keyboard.press('Delete');expect(gc(3,1)).to_have_value('');expect(gc(4,1)).to_have_value('61')
 page.keyboard.press('Control+z');expect(gc(3,1)).to_have_value('64')
 # Selection remains independent of distant scrolling and is safe to copy there.
 gc(4,1).click();gc(6,2).click(modifiers=['Shift']);copied_before=selected_copy()
 view=page.locator('.data-grid-viewport');view.evaluate('(e)=>{e.scrollTop=48000;e.scrollLeft=1500;e.dispatchEvent(new Event("scroll"))}');page.wait_for_timeout(100)
 scroll_before=view.evaluate('(e)=>[e.scrollTop,e.scrollLeft]');go_graph_and_back()
 assert view.evaluate('(e)=>[e.scrollTop,e.scrollLeft]')==scroll_before
 assert page.locator('.data-grid-cell.is-active input').get_attribute('data-row')=='6'
 assert page.locator('.data-grid-cell.is-active input').get_attribute('data-column')=='2'
 assert '6 selected' in page.locator('.data-grid-footer').inner_text()
 assert selected_copy()==copied_before
 assert view.evaluate('(e)=>[e.scrollTop,e.scrollLeft]')==scroll_before
 # Publishing a cached range must resynchronize the graph after visiting another table.
 view.evaluate('(e)=>{e.scrollTop=0;e.scrollLeft=0;e.dispatchEvent(new Event("scroll"))}');page.wait_for_timeout(100)
 gc(0,0).click();gc(2,1).click(modifiers=['Shift'])
 page.evaluate('''()=>{window.gridSelectedArcs=[];const arc=CanvasRenderingContext2D.prototype.arc;CanvasRenderingContext2D.prototype.arc=function(x,y,...rest){if(this.canvas.getAttribute('aria-label')==='Selected observations from the data table')window.gridSelectedArcs.push([x,y]);return arc.call(this,x,y,...rest)}}''')
 def graph_selection():return page.evaluate('()=>Array.from(new Set(window.gridSelectedArcs.map(p=>JSON.stringify(p)))).sort()')
 def reset_graph_probe():page.evaluate('window.gridSelectedArcs=[]')
 page.locator('.sheet-navigator').get_by_title('Treatment response study graph',exact=True).click()
 first_selection=graph_selection();assert len(first_selection)==6
 page.locator('.sheet-navigator').get_by_title('Treatment response study',exact=True).click()
 page.get_by_role('button',name='New Data Table and Graph',exact=True).click();nt=page.get_by_role('dialog',name='New Data Table and Graph',exact=True);nt.get_by_role('button',name='XY',exact=True).click();nt.get_by_role('radio',name='Start with sample data',exact=True).check();nt.get_by_role('button',name='Create table and graph',exact=True).click()
 gc(0,1).click();gc(1,2).click(modifiers=['Shift'])
 reset_graph_probe();page.locator('.sheet-navigator').get_by_title('Dose response study graph',exact=True).click();page.get_by_role('dialog',name='Change Graph Type',exact=True).get_by_role('button',name='OK',exact=True).click();assert len(graph_selection())==4
 page.wait_for_function("JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets.filter(s=>s.kind==='data').length===2")
 sheets_before=page.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets)")
 page.locator('.sheet-navigator').get_by_title('Treatment response study',exact=True).click()
 assert '6 selected' in page.locator('.data-grid-footer').inner_text()
 # Do not focus or click a grid cell here: restoration itself must publish A's range.
 reset_graph_probe();page.locator('.sheet-navigator').get_by_title('Treatment response study graph',exact=True).click()
 assert graph_selection()==first_selection
 # An explicit graph-point request must override A's restored six-cell rectangle.
 page.locator('circle').filter(has_text='Treatment B, row 7:').click()
 page.get_by_role('button',name='Go to cell',exact=True).click()
 expect(page.locator('.data-grid-cell.is-active input')).to_have_attribute('data-row','6')
 expect(page.locator('.data-grid-cell.is-active input')).to_have_attribute('data-column','2')
 assert page.locator('td[aria-selected="true"]').count()==1
 assert page.evaluate('document.activeElement.dataset.row')=='6'
 reset_graph_probe();page.locator('.sheet-navigator').get_by_title('Treatment response study graph',exact=True).click();assert len(graph_selection())==1
 page.locator('.sheet-navigator').get_by_title('Treatment response study',exact=True).click()
 assert page.locator('td[aria-selected="true"]').count()==1
 assert page.locator('.data-grid-cell.is-active input').get_attribute('data-row')=='6'
 assert page.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets)")==sheets_before
 # Navigation/restoration must not create undo entries: one undo removes sample B.
 page.get_by_role('button',name='Undo',exact=True).click()
 page.wait_for_function("JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets.filter(s=>s.kind==='data').length===1")
 regression_checks=['selected-range Cmd/Ctrl undo and redo','TSV paste workbook undo and redo','caret mode preserves native text undo','range and active cell survive sheet remount','restored anchor supports Shift+arrow and safe clear','offscreen range copy preserves cached scroll','cross-table restored range matches graph highlights','point-to-cell navigation overrides restored range','selection restoration leaves data and undo history unchanged']
 if os.environ.get('GP_GRID_FOCUSED'):
  assert not errors,errors
  result={'passed':regression_checks,'errors':errors}
  (out/'browser-grid-review-regressions.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close();sys.exit(0)
 page.wait_for_function("JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets.find(s=>s.kind==='data').project.columns[1].values[3]==='64'")
 page.evaluate('''() => { const w=JSON.parse(localStorage.getItem('gp.workbook.v2')); w.version=2; const d=w.sheets.find(s=>s.kind==='data');d.project.columns=Array.from({length:8},(_,c)=>({name:`Data ${c+1}`,values:Array.from({length:10000},(_,r)=>String(c*10000+r+1))}));localStorage.setItem('gp.workbook.v2',JSON.stringify(w));}''')
 page.reload();page.wait_for_selector('.data-grid-viewport')
 def cell(r,c):return page.locator(f'input[data-row="{r}"][data-column="{c}"]')
 def scroll(y,x=0):
  page.locator('.data-grid-viewport').evaluate('(e,p)=>{e.scrollTop=p.y;e.scrollLeft=p.x;e.dispatchEvent(new Event("scroll"))}',{'y':y,'x':x})
  page.wait_for_timeout(100)
 def copy():
  return page.evaluate('''() => {const data=new DataTransfer();document.activeElement.dispatchEvent(new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true}));return data.getData('text/plain')}''')
 def dims():return page.locator('.data-grid-viewport').evaluate('(e)=>({top:e.scrollTop,left:e.scrollLeft,h:e.clientHeight,sh:e.scrollHeight,w:e.clientWidth,sw:e.scrollWidth})')
 initial_count=page.locator('[data-grid-row]').count();assert initial_count<=80
 cell(0,0).click();page.keyboard.type('123');expect(cell(0,0)).to_have_value('123')
 assert page.evaluate('document.activeElement.dataset.row')=='0'
 page.keyboard.press('Enter');assert page.evaluate('document.activeElement.dataset.row')=='1'
 page.keyboard.type('-4.5');expect(cell(1,0)).to_have_value('-4.5')
 page.keyboard.press('Shift+Enter');assert page.evaluate('document.activeElement.dataset.row')=='0'
 page.keyboard.press('Tab');assert page.evaluate('document.activeElement.dataset.column')=='1'
 page.keyboard.press('Shift+Tab');assert page.evaluate('document.activeElement.dataset.column')=='0'
 page.keyboard.press('F2');page.keyboard.press('End');page.keyboard.type('4');expect(cell(0,0)).to_have_value('1234')
 page.keyboard.press('Escape');cell(2,1).click(modifiers=['Shift'])
 assert page.locator('td[aria-selected="true"]').count()==6
 assert copy()=='1234\t10001\r\n-4.5\t10002\r\n3\t10003',repr(copy())
 page.keyboard.press('Delete');expect(cell(0,0)).to_have_value('');expect(cell(2,1)).to_have_value('');expect(cell(3,0)).to_have_value('4')
 # Pointer range works without selecting input text.
 cell(3,0).click();a=cell(3,0).bounding_box();z=cell(5,2).bounding_box()
 page.mouse.move(a['x']+15,a['y']+12);page.mouse.down();page.mouse.move(z['x']+15,z['y']+12,steps=8);page.wait_for_timeout(100);page.mouse.up()
 assert page.locator('td[aria-selected="true"]').count()==9
 assert copy().split('\r\n')[0]=='4\t10004\t20004'
 # Numeric drafts stay visible, with accessible error state.
 cell(4,0).click();page.keyboard.type('-');expect(cell(4,0)).to_have_attribute('aria-invalid','true')
 page.keyboard.type('3.2');expect(cell(4,0)).to_have_value('-3.2');expect(cell(4,0)).not_to_have_attribute('aria-invalid','true')
 # Resize changes geometry and all scroll/width state survives sheet unmount.
 handle=page.get_by_role('separator',name='Resize column A',exact=True);box=handle.bounding_box();page.mouse.move(box['x']+3,box['y']+20);page.mouse.down();page.mouse.move(box['x']+83,box['y']+20,steps=6);page.mouse.up()
 expect(handle).to_have_attribute('aria-valuenow','192')
 assert round(cell(0,0).bounding_box()['width'])==191
 # Focus is preserved even when manually scrolling to a distant virtual window.
 cell(4,0).click();scroll(150000,1500)
 assert page.locator('[data-grid-row]').count()<=80
 assert page.locator('input[data-row]').count()<2000
 assert page.evaluate('document.activeElement.dataset.row')=='4'
 pinned=page.locator('.data-grid-row-number').last.bounding_box()['x'];v=page.locator('.data-grid-viewport').bounding_box()['x'];assert abs(pinned-v)<1
 old=dims()
 page.locator('.sheet-navigator').get_by_title('Treatment response study graph',exact=True).click()
 page.locator('.sheet-navigator').get_by_title('Treatment response study',exact=True).click()
 assert dims()['top']==old['top'] and dims()['left']==old['left'],(old,dims())
 # Both advertised blank bounds are reachable. Typing materializes only on edit.
 scroll(999999,999999)
 expect(cell(9999,29)).to_be_visible()
 before=time.monotonic();cell(9999,29).click();page.keyboard.type('987.5');expect(cell(9999,29)).to_have_value('987.5');edit_ms=round((time.monotonic()-before)*1000)
 assert page.locator('[data-grid-row]').count()<=80
 page.wait_for_function("JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets.find(s=>s.kind==='data').project.columns[29]?.values[9999]==='987.5'")
 assert dims()['top']>230000 and dims()['left']>2000
 page.screenshot(path=str(out/'bottom-right.png'))
 page.reload();page.wait_for_selector('.data-grid-viewport');scroll(999999,999999);expect(cell(9999,29)).to_have_value('987.5')
 # Context row controls are real and reachable through virtual row headers.
 page.get_by_role('button',name='Select row 10000',exact=True).click(button='right')
 expect(page.get_by_role('menuitem',name='Delete row',exact=True)).to_be_enabled()
 page.get_by_role('menuitem',name='Delete row',exact=True).click()
 page.wait_for_function("JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets.find(s=>s.kind==='data').project.columns[29].values.length===9999")
 scroll(0,0)
 assert page.get_by_role('separator',name='Resize column A',exact=True).get_attribute('aria-valuenow')=='112' # widths intentionally session-only (reload resets)
 cell(0,0).click();page.keyboard.press('Control+a');assert '300,000 selected' in page.locator('.data-grid-footer').inner_text();page.keyboard.press('Delete')
 page.wait_for_function("JSON.parse(localStorage.getItem('gp.workbook.v2')).sheets.find(s=>s.kind==='data').project.columns.every(c=>c.values.every(v=>v===''))")
 assert not errors,errors
 result={'passed':regression_checks+['10k bounded DOM','replace typing','Enter/ShiftEnter/Tab navigation','F2 caret edit','shift rectangular selection','TSV copy','range delete','pointer rectangular selection','numeric draft aria-invalid','column resize','offscreen focus preserved','row numbers pinned','sheet scroll+width restore','10000×30 blank canvas editable','bottom-right persisted reload','row context delete','select all clear'], 'initial_rows':initial_count,'large_edit_ms_including_playwright':edit_ms,'errors':errors}
 (out/'browser-grid.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));b.close()
