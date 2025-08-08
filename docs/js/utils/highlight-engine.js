// HighlightEngine: robust range serialization and cross-paragraph highlighting
// Exposes static methods on window.HighlightEngine

(function(){
  class HighlightEngine {
    // Compute XPath for a node relative to a root element
    static getXPath(node, root) {
      const segments = [];
      let current = node;

      const isText = (n) => n && n.nodeType === Node.TEXT_NODE;
      const isElement = (n) => n && n.nodeType === Node.ELEMENT_NODE;

      while (current && current !== root) {
        if (current === document) break; // safety
        if (isElement(current)) {
          const tag = current.tagName.toLowerCase();
          // position among same-tag siblings (1-indexed)
          let index = 1;
          let sibling = current.previousSibling;
          while (sibling) {
            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName.toLowerCase() === tag) {
              index++;
            }
            sibling = sibling.previousSibling;
          }
          segments.unshift(`${tag}[${index}]`);
        } else if (isText(current)) {
          // index among text() nodes under parent
          const parent = current.parentNode;
          let textIndex = 1;
          for (let i = 0; i < parent.childNodes.length; i++) {
            const n = parent.childNodes[i];
            if (n === current) break;
            if (n.nodeType === Node.TEXT_NODE) textIndex++;
          }
          segments.unshift(`text()[${textIndex}]`);
          // step to parent for next iteration because text nodes have no tagName
        }
        current = current.nodeType === Node.TEXT_NODE ? current.parentNode : current.parentNode;
      }

      // If root is body/document or not a parent, fall back to absolute from document.body
      const prefix = root && root !== document && root !== document.body ? '.' : '';
      const rootPath = (root && root !== document && root !== document.body) ? '' : '/html/body';
      const path = (prefix ? '.' : '') + (rootPath ? rootPath : '') + (segments.length ? '/' + segments.join('/') : '');
      return path || '.';
    }

    static evalXPath(xpath, root) {
      try {
        const resolver = null;
        const context = root && root.nodeType === 1 ? root : document;
        const result = document.evaluate(xpath, context, resolver, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue || null;
      } catch (e) {
        console.warn('XPath evaluation failed:', xpath, e);
        return null;
      }
    }

    static serializeRange(range, root) {
      if (!range) return null;
      const startNode = range.startContainer;
      const endNode = range.endContainer;
      return {
        startXPath: HighlightEngine.getXPath(startNode, root),
        startOffset: range.startOffset,
        endXPath: HighlightEngine.getXPath(endNode, root),
        endOffset: range.endOffset
      };
    }

    static restoreRange(serialized, root) {
      if (!serialized) return null;
      const startNode = HighlightEngine.evalXPath(serialized.startXPath, root);
      const endNode = HighlightEngine.evalXPath(serialized.endXPath, root);
      if (!startNode || !endNode) return null;
      try {
        const r = document.createRange();
        r.setStart(startNode, Math.min(serialized.startOffset ?? 0, HighlightEngine.maxOffset(startNode)));
        r.setEnd(endNode, Math.min(serialized.endOffset ?? 0, HighlightEngine.maxOffset(endNode)));
        return r;
      } catch (e) {
        console.warn('Failed to restore range:', e);
        return null;
      }
    }

    static maxOffset(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent.length;
      if (node.nodeType === Node.ELEMENT_NODE) return node.childNodes.length;
      return 0;
    }

    // Apply highlight across potentially multiple text nodes using marker and TreeWalker approach
    static applyRangeHighlight(range, highlightId, className = 'text-highlight', timestamp) {
      if (!range || range.collapsed) return false;
      try {
        // Insert markers
        const startMarker = document.createElement('span');
        startMarker.className = 'he-start-marker';
        startMarker.style.display = 'none';
        startMarker.setAttribute('data-highlight-id', highlightId);

        const endMarker = document.createElement('span');
        endMarker.className = 'he-end-marker';
        endMarker.style.display = 'none';
        endMarker.setAttribute('data-highlight-id', highlightId);

        const work = range.cloneRange();
        work.collapse(false);
        work.insertNode(endMarker);
        work.setStart(range.startContainer, range.startOffset);
        work.collapse(true);
        work.insertNode(startMarker);

        // Build a range from markers
        const applyRange = document.createRange();
        applyRange.setStartAfter(startMarker);
        applyRange.setEndBefore(endMarker);

        // Walk text nodes intersecting the range
        const common = applyRange.commonAncestorContainer;
        const walker = document.createTreeWalker(
          common,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => applyRange.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
          },
          false
        );

        const nodes = [];
        let n;
        while ((n = walker.nextNode())) {
          // Ensure node is within boundary points
          const nr = document.createRange();
          nr.selectNodeContents(n);
          if (applyRange.compareBoundaryPoints(Range.START_TO_END, nr) > 0 &&
              applyRange.compareBoundaryPoints(Range.END_TO_START, nr) < 0) {
            nodes.push(n);
          }
        }

        nodes.forEach((textNode, i) => {
          const span = document.createElement('span');
          span.className = className;
          span.setAttribute('data-highlight-id', highlightId);
          span.setAttribute('data-highlight-part', i + 1);
          if (timestamp) {
            span.setAttribute('title', `Highlighted on ${new Date(timestamp).toLocaleDateString()}`);
          }
          span.appendChild(textNode.cloneNode(true));
          textNode.parentNode.replaceChild(span, textNode);
        });

        // Cleanup markers
        startMarker.remove();
        endMarker.remove();
        return nodes.length > 0;
      } catch (e) {
        console.warn('applyRangeHighlight failed, will fallback:', e);
        return false;
      }
    }

    static scrollToRange(range, behavior = 'smooth', container = null) {
      if (!range) return;
      const rects = range.getClientRects();
      const canScrollContainer = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const scrollable = (el.scrollHeight - el.clientHeight) > 1;
        return (overflowY !== 'visible' && overflowY !== 'hidden') && scrollable;
      };
      if (rects && rects.length) {
        const rect = rects[0];
        if (container && typeof container.scrollTo === 'function' && canScrollContainer(container)) {
          const containerRect = container.getBoundingClientRect();
          const targetTop = container.scrollTop + (rect.top - containerRect.top) - 100;
          container.scrollTo({ top: Math.max(0, targetTop), behavior });
        } else {
          window.scrollTo({ top: window.scrollY + rect.top - 100, behavior });
        }
      } else if (range.startContainer) {
        const el = range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer
          : range.startContainer.parentElement;
        if (el) {
          if (container && typeof container.scrollTo === 'function' && canScrollContainer(container)) {
            const elRect = el.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const targetTop = container.scrollTop + (elRect.top - containerRect.top) - 100;
            container.scrollTo({ top: Math.max(0, targetTop), behavior });
          } else {
            el.scrollIntoView({ behavior, block: 'center' });
          }
        }
      }
    }
  }

  window.HighlightEngine = HighlightEngine;
})();
