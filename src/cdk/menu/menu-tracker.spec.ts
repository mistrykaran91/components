import {Component, ElementRef, QueryList, ViewChild, ViewChildren} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {Subject} from 'rxjs';
import {dispatchMouseEvent} from '../testing/private';
import {CdkContextMenuTrigger} from './context-menu-trigger';
import {CdkMenu} from './menu';
import {CdkMenuItem} from './menu-item';
import {MenuStack} from './menu-stack';
import {CdkMenuTrigger} from './menu-trigger';

describe('MenuTracker', () => {
  describe('with a context menu and a menu trigger on the same element', () => {
    let fixture: ComponentFixture<ContextMenuAndMenuTriggerOnSameElement>;

    function getTarget() {
      return fixture.componentInstance.target.nativeElement;
    }

    beforeEach(() => {
      // Previously this setup could get the `MenuStack` stuck in an infinite synchronous loop that
      // hangs the browser. Each `MenuStack` loop emits on its `_close` subject on every iteration,
      // so we cap the number of emissions and throw from inside the loop to turn a hang into a
      // test failure. Note that throwing from a subscriber or a spy on a method that isn't called
      // directly by the loop won't work, because RxJS reports subscriber errors asynchronously.
      const maxCloseEmissions = 500;
      const guardedSubjects = new WeakSet<Subject<unknown>>();
      let closeEmissions = 0;
      const originalPush = MenuStack.prototype.push;

      spyOn(MenuStack.prototype, 'push').and.callFake(function (this: MenuStack, menu) {
        const closeSubject = (this as unknown as {_close: Subject<unknown>})._close;

        if (!guardedSubjects.has(closeSubject)) {
          const originalNext = closeSubject.next;
          guardedSubjects.add(closeSubject);
          closeSubject.next = function (value: unknown) {
            if (++closeEmissions > maxCloseEmissions) {
              throw new Error(`MenuStack emitted more than ${maxCloseEmissions} close events.`);
            }
            originalNext.call(closeSubject, value);
          };
        }

        return originalPush.call(this, menu);
      });

      fixture = TestBed.createComponent(ContextMenuAndMenuTriggerOnSameElement);
      fixture.detectChanges();
    });

    it('should close the context menu when the menu trigger is clicked afterwards', () => {
      dispatchMouseEvent(getTarget(), 'contextmenu');
      fixture.detectChanges();
      expect(fixture.componentInstance.menus.length).toBe(1);

      getTarget().click();
      fixture.detectChanges();

      expect(fixture.componentInstance.menus.length)
        .withContext('only the menu opened last should remain open')
        .toBe(1);
      expect(fixture.nativeElement.ownerDocument.querySelector('#context-menu')).toBeNull();
      expect(fixture.nativeElement.ownerDocument.querySelector('#trigger-menu')).not.toBeNull();
    });

    it('should close the menu trigger menu when the context menu is opened afterwards', () => {
      getTarget().click();
      fixture.detectChanges();
      expect(fixture.componentInstance.menus.length).toBe(1);

      dispatchMouseEvent(getTarget(), 'contextmenu');
      fixture.detectChanges();

      expect(fixture.componentInstance.menus.length)
        .withContext('only the menu opened last should remain open')
        .toBe(1);
      expect(fixture.nativeElement.ownerDocument.querySelector('#trigger-menu')).toBeNull();
      expect(fixture.nativeElement.ownerDocument.querySelector('#context-menu')).not.toBeNull();
    });

    it('should never leave more than one menu open when alternating the two triggers', () => {
      for (let i = 0; i < 5; i++) {
        dispatchMouseEvent(getTarget(), 'contextmenu');
        fixture.detectChanges();
        getTarget().click();
        fixture.detectChanges();

        expect(fixture.componentInstance.menus.length).toBe(1);
      }
    });
  });

  describe('with a context menu and menu triggers on different elements', () => {
    let fixture: ComponentFixture<ContextMenuAndMenuTriggerOnDifferentElements>;

    function query(selector: string): HTMLElement | null {
      return fixture.nativeElement.ownerDocument.querySelector(selector);
    }

    function getTrigger(id: string) {
      return fixture.debugElement.query(By.css(`#${id}`)).injector.get(CdkMenuTrigger);
    }

    beforeEach(() => {
      fixture = TestBed.createComponent(ContextMenuAndMenuTriggerOnDifferentElements);
      fixture.detectChanges();
    });

    // These menus are opened without a pointer event, so the overlay's outside-click handling
    // can't close the previous menu. Only `MenuTracker` coordinates them.
    describe('when opened programmatically', () => {
      it('should close the previous menu trigger menu when another one is opened', () => {
        const first = getTrigger('trigger-target');
        const second = getTrigger('second-trigger-target');

        first.open();
        fixture.detectChanges();
        second.open();
        fixture.detectChanges();

        expect(first.isOpen()).toBe(false);
        expect(second.isOpen()).toBe(true);
      });
    });

    describe('when opened through user interaction', () => {
      it('should close the context menu when a menu trigger is clicked', () => {
        dispatchMouseEvent(query('#context-target')!, 'contextmenu');
        fixture.detectChanges();
        expect(query('#context-menu')).not.toBeNull();

        query('#trigger-target')!.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.menus.length).toBe(1);
        expect(query('#context-menu')).toBeNull();
        expect(query('#trigger-menu')).not.toBeNull();
      });

      it('should close the menu trigger menu when the context menu is opened', () => {
        query('#trigger-target')!.click();
        fixture.detectChanges();
        expect(query('#trigger-menu')).not.toBeNull();

        dispatchMouseEvent(query('#context-target')!, 'contextmenu');
        fixture.detectChanges();

        expect(fixture.componentInstance.menus.length).toBe(1);
        expect(query('#trigger-menu')).toBeNull();
        expect(query('#context-menu')).not.toBeNull();
      });
    });

    it('should not close a parent menu when opening one of its submenus', () => {
      query('#trigger-target')!.click();
      fixture.detectChanges();

      query('#submenu-trigger')!.click();
      fixture.detectChanges();

      expect(fixture.componentInstance.menus.length).toBe(2);
      expect(query('#trigger-menu')).not.toBeNull();
      expect(query('#submenu')).not.toBeNull();
    });
  });
});

@Component({
  template: `
    <div id="context-target" [cdkContextMenuTriggerFor]="context"></div>
    <div id="trigger-target" [cdkMenuTriggerFor]="trigger"></div>
    <div id="second-trigger-target" [cdkMenuTriggerFor]="secondTrigger"></div>

    <ng-template #context>
      <div cdkMenu id="context-menu">
        <button cdkMenuItem></button>
      </div>
    </ng-template>

    <ng-template #trigger>
      <div cdkMenu id="trigger-menu">
        <button cdkMenuItem id="submenu-trigger" [cdkMenuTriggerFor]="submenu"></button>
      </div>
    </ng-template>

    <ng-template #secondTrigger>
      <div cdkMenu id="second-trigger-menu">
        <button cdkMenuItem></button>
      </div>
    </ng-template>

    <ng-template #submenu>
      <div cdkMenu id="submenu">
        <button cdkMenuItem></button>
      </div>
    </ng-template>
  `,
  imports: [CdkContextMenuTrigger, CdkMenuTrigger, CdkMenu, CdkMenuItem],
})
class ContextMenuAndMenuTriggerOnDifferentElements {
  @ViewChildren(CdkMenu) menus: QueryList<CdkMenu>;
}

@Component({
  template: `
    <div #target [cdkContextMenuTriggerFor]="context" [cdkMenuTriggerFor]="trigger"></div>

    <ng-template #context>
      <div cdkMenu id="context-menu">
        <button cdkMenuItem></button>
      </div>
    </ng-template>

    <ng-template #trigger>
      <div cdkMenu id="trigger-menu">
        <button cdkMenuItem></button>
      </div>
    </ng-template>
  `,
  imports: [CdkContextMenuTrigger, CdkMenuTrigger, CdkMenu, CdkMenuItem],
})
class ContextMenuAndMenuTriggerOnSameElement {
  @ViewChild('target') target: ElementRef<HTMLElement>;
  @ViewChildren(CdkMenu) menus: QueryList<CdkMenu>;
}
